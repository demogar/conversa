import { Injectable, Logger } from '@nestjs/common';
import type { AuditEntryDto, Page } from '@conversa/shared';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';

export type AuditAction =
  | 'auth.signup'
  | 'auth.login'
  | 'auth.password_changed'
  | 'auth.password_reset'
  | 'auth.mfa_enabled'
  | 'auth.mfa_disabled'
  | 'workspace.created'
  | 'workspace.renamed'
  | 'member.invited'
  | 'member.invitation_revoked'
  | 'member.joined'
  | 'member.role_changed'
  | 'member.removed'
  | 'channel.connected'
  | 'channel.disconnected'
  | 'automation.created'
  | 'automation.updated'
  | 'automation.status_changed'
  | 'automation.deleted'
  | 'buffer.connected'
  | 'buffer.disconnected'
  | 'inbox.message_sent';

export interface AuditEvent {
  action: AuditAction;
  actorId?: string | null;
  workspaceId?: string | null;
  targetType?: string;
  targetId?: string;
  ip?: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Records an event. Auditing never fails the action being audited. */
  async record(event: AuditEvent): Promise<void> {
    try {
      await this.prisma.auditLog.create({ data: event });
    } catch (error) {
      this.logger.error({ err: error, action: event.action }, 'Audit write failed');
    }
  }

  async list(workspaceId: string, cursor: string | undefined, limit: number): Promise<Page<AuditEntryDto>> {
    const rows = await this.prisma.auditLog.findMany({
      where: { workspaceId },
      include: { actor: { select: { id: true, name: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const items = rows.slice(0, limit).map((row) => ({
      id: row.id,
      action: row.action,
      actor: row.actor,
      targetType: row.targetType,
      targetId: row.targetId,
      createdAt: row.createdAt.toISOString(),
    }));
    return { items, nextCursor: rows.length > limit ? (items.at(-1)?.id ?? null) : null };
  }
}
