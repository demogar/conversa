import { Injectable } from '@nestjs/common';
import {
  type CreatedInvitationDto,
  ErrorCode,
  type InvitationDto,
  type InvitationPreviewDto,
  isLocale,
} from '@conversa/shared';
import { AppConfig } from '../../config/app-config.js';
import { CryptoService } from '../../common/crypto/crypto.service.js';
import { AppException } from '../../common/errors/app.exception.js';
import { MailService } from '../../infra/mail/mail.service.js';
import { invitationMail } from '../../infra/mail/templates.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { Invitation, Prisma } from '../../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';

const INVITATION_TTL_MS = 7 * 24 * 3600 * 1000;

type Tx = Prisma.TransactionClient;

function toDto(invitation: Invitation & { invitedBy: { name: string } | null }): InvitationDto {
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    expiresAt: invitation.expiresAt.toISOString(),
    createdAt: invitation.createdAt.toISOString(),
    invitedBy: invitation.invitedBy?.name ?? null,
  };
}

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly mail: MailService,
    private readonly config: AppConfig,
    private readonly audit: AuditService,
  ) {}

  async list(workspaceId: string): Promise<InvitationDto[]> {
    const rows = await this.prisma.invitation.findMany({
      where: { workspaceId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { invitedBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toDto);
  }

  async create(
    workspaceId: string,
    inviterId: string,
    input: { email: string; role: 'ADMIN' | 'MEMBER' },
  ): Promise<CreatedInvitationDto> {
    const existing = await this.prisma.membership.findFirst({
      where: { workspaceId, user: { email: input.email } },
      select: { id: true },
    });
    if (existing) throw new AppException(ErrorCode.ALREADY_MEMBER);

    const token = this.crypto.randomToken(32);
    const [invitation, inviter, workspace] = await this.prisma.$transaction(async (tx) => {
      // A new invitation replaces any pending one for the same address.
      await tx.invitation.updateMany({
        where: { workspaceId, email: input.email, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      // One after another: a transaction runs on a single connection, which
      // cannot carry concurrent queries.
      const created = await tx.invitation.create({
        data: {
          workspaceId,
          email: input.email,
          role: input.role,
          tokenHash: this.crypto.hashToken(token),
          invitedById: inviterId,
          expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
        },
        include: { invitedBy: { select: { name: true } } },
      });
      const invitedBy = await tx.user.findUniqueOrThrow({
        where: { id: inviterId },
        select: { name: true, locale: true },
      });
      const target = await tx.workspace.findUniqueOrThrow({
        where: { id: workspaceId },
        select: { name: true },
      });
      return [created, invitedBy, target] as const;
    });

    const acceptUrl = this.config.url(`/invite/${token}`);
    const emailed = await this.mail.send(
      input.email,
      invitationMail(isLocale(inviter.locale) ? inviter.locale : 'en', {
        inviter: inviter.name,
        workspace: workspace.name,
        url: acceptUrl,
      }),
    );
    await this.audit.record({
      action: 'member.invited',
      actorId: inviterId,
      workspaceId,
      targetType: 'invitation',
      targetId: invitation.id,
      metadata: { role: input.role },
    });
    return { ...toDto(invitation), acceptUrl, emailed };
  }

  async revoke(workspaceId: string, actorId: string, invitationId: string): Promise<void> {
    const { count } = await this.prisma.invitation.updateMany({
      where: { id: invitationId, workspaceId, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) throw AppException.notFound();
    await this.audit.record({
      action: 'member.invitation_revoked',
      actorId,
      workspaceId,
      targetType: 'invitation',
      targetId: invitationId,
    });
  }

  async preview(token: string): Promise<InvitationPreviewDto> {
    const invitation = await this.findUsable(this.prisma, token);
    return {
      workspaceName: invitation.workspace.name,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }

  /** Accepts an invitation for an existing account inside a transaction. */
  async accept(tx: Tx, token: string, user: { id: string; email: string }): Promise<string> {
    const invitation = await this.findUsable(tx, token);
    if (invitation.email !== user.email)
      throw new AppException(ErrorCode.INVITATION_EMAIL_MISMATCH);

    const claimed = await tx.invitation.updateMany({
      where: { id: invitation.id, acceptedAt: null, revokedAt: null },
      data: { acceptedAt: new Date() },
    });
    if (claimed.count === 0) throw new AppException(ErrorCode.TOKEN_INVALID);

    await tx.membership.upsert({
      where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId: user.id } },
      create: { workspaceId: invitation.workspaceId, userId: user.id, role: invitation.role },
      update: {},
    });
    await this.audit.record({
      action: 'member.joined',
      actorId: user.id,
      workspaceId: invitation.workspaceId,
      metadata: { role: invitation.role },
    });
    return invitation.workspaceId;
  }

  async findUsable(db: Tx | PrismaService, token: string) {
    const invitation = await db.invitation.findUnique({
      where: { tokenHash: this.crypto.hashToken(token) },
      include: { workspace: { select: { name: true } } },
    });
    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.revokedAt ||
      invitation.expiresAt <= new Date()
    ) {
      throw new AppException(ErrorCode.TOKEN_INVALID);
    }
    return invitation;
  }
}
