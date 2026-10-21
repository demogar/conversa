import { Injectable } from '@nestjs/common';
import {
  type ChangePasswordInput,
  ErrorCode,
  type MeDto,
  type MfaSetupDto,
  type RecoveryCodesDto,
  type SessionDto,
  type UpdateProfileInput,
  type UserDto,
} from '@conversa/shared';
import { CryptoService } from '../../common/crypto/crypto.service.js';
import { AppException } from '../../common/errors/app.exception.js';
import { toUserDto } from '../../common/mappers/user.mapper.js';
import type { AuthContext } from '../../common/http/request.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { MfaService } from '../auth/mfa.service.js';
import { PasswordService } from '../auth/password.service.js';
import { SessionService } from '../auth/session.service.js';
import { WorkspacesService } from '../workspaces/workspaces.service.js';

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly mfa: MfaService,
    private readonly crypto: CryptoService,
    private readonly workspaces: WorkspacesService,
    private readonly audit: AuditService,
  ) {}

  async me(userId: string): Promise<MeDto> {
    const [user, workspaces] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.workspaces.listForUser(userId),
    ]);
    return { user: toUserDto(user), workspaces };
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<UserDto> {
    const user = await this.prisma.user.update({ where: { id: userId }, data: input });
    return toUserDto(user);
  }

  /** Signs out every other session, since a password change usually means "lock others out". */
  async changePassword(auth: AuthContext, input: ChangePasswordInput, ip: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.userId } });
    if (!(await this.passwords.verify(user.passwordHash, input.currentPassword))) {
      throw new AppException(ErrorCode.INVALID_CREDENTIALS);
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await this.passwords.hash(input.newPassword) },
    });
    await this.sessions.revokeAll(user.id, auth.sessionId);
    await this.audit.record({ action: 'auth.password_changed', actorId: user.id, ip });
  }

  async listSessions(auth: AuthContext): Promise<SessionDto[]> {
    const rows = await this.prisma.session.findMany({
      where: { userId: auth.userId, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      current: row.id === auth.sessionId,
      userAgent: row.userAgent,
      ip: row.ip,
      createdAt: row.createdAt.toISOString(),
      lastSeenAt: row.lastSeenAt.toISOString(),
    }));
  }

  async revokeSession(auth: AuthContext, sessionId: string): Promise<void> {
    if (!(await this.sessions.revoke(auth.userId, sessionId))) throw AppException.notFound();
  }

  /** Starts setup: the secret is stored but MFA stays off until a code proves it works. */
  async startMfaSetup(userId: string): Promise<Omit<MfaSetupDto, 'qrSvg'>> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.mfaEnabledAt) throw new AppException(ErrorCode.CONFLICT);
    const { secret, otpauthUrl } = this.mfa.createSecret(user.email);
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: this.crypto.encrypt(secret) },
    });
    return { secret, otpauthUrl };
  }

  async enableMfa(auth: AuthContext, code: string, ip: string): Promise<RecoveryCodesDto> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.userId } });
    if (user.mfaEnabledAt || !user.mfaSecret) throw new AppException(ErrorCode.CONFLICT);
    if (!(await this.mfa.verifyCode(user.id, user.mfaSecret, code))) {
      throw new AppException(ErrorCode.MFA_INVALID);
    }
    const { codes, hashes } = this.mfa.generateRecoveryCodes();
    await this.prisma.user.update({
      where: { id: user.id },
      data: { mfaEnabledAt: new Date(), mfaRecoveryHashes: hashes },
    });
    await this.sessions.revokeAll(user.id, auth.sessionId);
    await this.audit.record({ action: 'auth.mfa_enabled', actorId: user.id, ip });
    return { recoveryCodes: codes };
  }

  async disableMfa(userId: string, password: string, ip: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await this.passwords.verify(user.passwordHash, password))) {
      throw new AppException(ErrorCode.INVALID_CREDENTIALS);
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabledAt: null, mfaSecret: null, mfaRecoveryHashes: [] },
    });
    await this.audit.record({ action: 'auth.mfa_disabled', actorId: userId, ip });
  }
}
