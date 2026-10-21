import { Injectable } from '@nestjs/common';
import {
  ErrorCode,
  type ForgotPasswordInput,
  isLocale,
  type LoginInput,
  type LoginResultDto,
  type MfaVerifyInput,
  type ResetPasswordInput,
  type SignupInput,
  type UserDto,
  WorkspaceRole,
} from '@conversa/shared';
import { AppConfig } from '../../config/app-config.js';
import { CryptoService } from '../../common/crypto/crypto.service.js';
import { AppException } from '../../common/errors/app.exception.js';
import { toUserDto } from '../../common/mappers/user.mapper.js';
import { TurnstileService } from '../../common/security/turnstile.service.js';
import { MailService } from '../../infra/mail/mail.service.js';
import { passwordResetMail } from '../../infra/mail/templates.js';
import { isUniqueViolation } from '../../infra/prisma/errors.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { User } from '../../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { InvitationsService } from '../workspaces/invitations.service.js';
import { MfaService } from './mfa.service.js';
import { PasswordService } from './password.service.js';
import { type ClientInfo, SessionService } from './session.service.js';

const MFA_CHALLENGE_TTL_SECONDS = 5 * 60;
const RESET_TTL_MS = 60 * 60 * 1000;
const LOCK_AFTER_FAILURES = 5;
const BASE_LOCK_MS = 15 * 60 * 1000;
const MAX_LOCK_MS = 24 * 3600 * 1000;
// Serialises sign-ups so only one request can become the first account.
const SIGNUP_LOCK_KEY = 4_242_001;

export interface SignedIn {
  user: UserDto;
  token: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly mfa: MfaService,
    private readonly crypto: CryptoService,
    private readonly invitations: InvitationsService,
    private readonly turnstile: TurnstileService,
    private readonly mail: MailService,
    private readonly config: AppConfig,
    private readonly audit: AuditService,
  ) {}

  async signup(input: SignupInput, client: ClientInfo): Promise<SignedIn> {
    await this.turnstile.assertHuman(input.captchaToken, client.ip);
    const passwordHash = await this.passwords.hash(input.password);

    let user: User;
    try {
      user = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SIGNUP_LOCK_KEY})`;
        const isFirstAccount = (await tx.user.count()) === 0;
        const invitation = input.invitationToken
          ? await this.invitations.findUsable(tx, input.invitationToken)
          : null;
        if (!isFirstAccount && !invitation && this.config.env.SIGNUP_MODE !== 'open') {
          throw new AppException(ErrorCode.SIGNUP_CLOSED);
        }
        if (invitation && invitation.email !== input.email) {
          throw new AppException(ErrorCode.INVITATION_EMAIL_MISMATCH);
        }

        const created = await tx.user.create({
          data: {
            email: input.email,
            name: input.name,
            passwordHash,
            locale: input.locale && isLocale(input.locale) ? input.locale : 'en',
          },
        });
        if (invitation && input.invitationToken) {
          await this.invitations.accept(tx, input.invitationToken, created);
        } else {
          await tx.workspace.create({
            data: {
              name: input.name,
              memberships: { create: { userId: created.id, role: WorkspaceRole.OWNER } },
            },
          });
        }
        return created;
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new AppException(ErrorCode.EMAIL_TAKEN);
      throw error;
    }

    await this.audit.record({ action: 'auth.signup', actorId: user.id, ip: client.ip });
    return { user: toUserDto(user), token: await this.sessions.create(user.id, client) };
  }

  async login(input: LoginInput, client: ClientInfo): Promise<LoginResultDto | SignedIn> {
    await this.turnstile.assertHuman(input.captchaToken, client.ip);
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      await this.passwords.verifyAgainstDummy(input.password);
      throw new AppException(ErrorCode.INVALID_CREDENTIALS);
    }
    this.assertNotLocked(user);
    if (!(await this.passwords.verify(user.passwordHash, input.password))) {
      await this.registerFailure(user);
      throw new AppException(ErrorCode.INVALID_CREDENTIALS);
    }

    if (user.mfaEnabledAt && user.mfaSecret) {
      // The challenge is bound to the password hash, so a password change
      // invalidates challenges issued before it.
      const challenge = this.crypto.sign(
        'mfa-challenge',
        { uid: user.id, ph: this.crypto.hashToken(user.passwordHash).slice(0, 16) },
        MFA_CHALLENGE_TTL_SECONDS,
      );
      return { status: 'mfa_required', challenge };
    }
    return this.completeLogin(user, client);
  }

  async verifyMfa(input: MfaVerifyInput, client: ClientInfo): Promise<SignedIn> {
    const payload = this.crypto.verify<{ uid: string; ph: string }>('mfa-challenge', input.challenge);
    if (!payload) throw new AppException(ErrorCode.TOKEN_INVALID);
    const user = await this.prisma.user.findUnique({ where: { id: payload.uid } });
    if (!user?.mfaSecret || !user.mfaEnabledAt) throw new AppException(ErrorCode.TOKEN_INVALID);
    if (this.crypto.hashToken(user.passwordHash).slice(0, 16) !== payload.ph) {
      throw new AppException(ErrorCode.TOKEN_INVALID);
    }
    this.assertNotLocked(user);

    const code = input.code.replace(/\s+/g, '');
    if (await this.mfa.verifyCode(user.id, user.mfaSecret, code)) return this.completeLogin(user, client);

    const recoveryHash = this.mfa.hashRecoveryCode(code);
    if (user.mfaRecoveryHashes.includes(recoveryHash)) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { mfaRecoveryHashes: user.mfaRecoveryHashes.filter((hash) => hash !== recoveryHash) },
      });
      return this.completeLogin(user, client);
    }

    await this.registerFailure(user);
    throw new AppException(ErrorCode.MFA_INVALID);
  }

  async logout(sessionId: string, userId: string): Promise<void> {
    await this.sessions.revoke(userId, sessionId);
  }

  /** Always succeeds from the caller's view, so it cannot reveal which emails exist. */
  async forgotPassword(input: ForgotPasswordInput, ip: string): Promise<void> {
    await this.turnstile.assertHuman(input.captchaToken, ip);
    if (!this.mail.enabled) throw new AppException(ErrorCode.MAIL_NOT_CONFIGURED);
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) return;

    const token = this.crypto.randomToken(32);
    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash: this.crypto.hashToken(token),
        expiresAt: new Date(Date.now() + RESET_TTL_MS),
      },
    });
    await this.mail.send(
      user.email,
      passwordResetMail(isLocale(user.locale) ? user.locale : 'en', {
        url: this.config.url(`/reset-password?token=${encodeURIComponent(token)}`),
      }),
    );
  }

  async resetPassword(input: ResetPasswordInput, ip: string): Promise<void> {
    const reset = await this.prisma.passwordReset.findUnique({
      where: { tokenHash: this.crypto.hashToken(input.token) },
    });
    if (!reset || reset.usedAt || reset.expiresAt <= new Date()) {
      throw new AppException(ErrorCode.TOKEN_INVALID);
    }
    const passwordHash = await this.passwords.hash(input.password);
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordReset.updateMany({
        where: { id: reset.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (claimed.count === 0) throw new AppException(ErrorCode.TOKEN_INVALID);
      await tx.user.update({
        where: { id: reset.userId },
        data: { passwordHash, failedLogins: 0, lockedUntil: null },
      });
      await tx.session.deleteMany({ where: { userId: reset.userId } });
      await tx.passwordReset.deleteMany({ where: { userId: reset.userId, id: { not: reset.id } } });
    });
    await this.audit.record({ action: 'auth.password_reset', actorId: reset.userId, ip });
  }

  private async completeLogin(user: User, client: ClientInfo): Promise<SignedIn> {
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    await this.audit.record({ action: 'auth.login', actorId: user.id, ip: client.ip });
    return { user: toUserDto(user), token: await this.sessions.create(user.id, client) };
  }

  private assertNotLocked(user: User): void {
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AppException(ErrorCode.ACCOUNT_LOCKED);
    }
  }

  /** Every fifth failure locks the account, for twice as long each time. */
  private async registerFailure(user: User): Promise<void> {
    const failures = user.failedLogins + 1;
    const lockedUntil =
      failures % LOCK_AFTER_FAILURES === 0
        ? new Date(
            Date.now() +
              Math.min(BASE_LOCK_MS * 2 ** (failures / LOCK_AFTER_FAILURES - 1), MAX_LOCK_MS),
          )
        : user.lockedUntil;
    await this.prisma.user.update({ where: { id: user.id }, data: { failedLogins: failures, lockedUntil } });
  }
}
