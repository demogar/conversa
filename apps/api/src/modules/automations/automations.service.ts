import { Injectable } from '@nestjs/common';
import {
  type AutomationDto,
  type AutomationStatsDto,
  automationResponseSchema,
  type CreateAutomationInput,
  ErrorCode,
  type UpdateAutomationInput,
} from '@conversa/shared';
import { AppException } from '../../common/errors/app.exception.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { Automation, AutomationStatus, Prisma } from '../../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { TrackedLinksService } from '../links/tracked-links.service.js';

const EMPTY_STATS: AutomationStatsDto = { triggered: 0, sent: 0, failed: 0, clicks: 0 };

function toDto(automation: Automation, stats: AutomationStatsDto = EMPTY_STATS): AutomationDto {
  return {
    id: automation.id,
    name: automation.name,
    status: automation.status,
    channelId: automation.channelId,
    triggerType: automation.triggerType,
    postScope: automation.postScope,
    mediaIds: automation.mediaIds,
    bufferPostId: automation.bufferPostId,
    matchMode: automation.matchMode,
    keywords: automation.keywords,
    wholeWord: automation.wholeWord,
    oncePerContact: automation.oncePerContact,
    response: automationResponseSchema.parse(automation.response),
    stats,
    createdAt: automation.createdAt.toISOString(),
    updatedAt: automation.updatedAt.toISOString(),
  };
}

type AutomationFields = Omit<UpdateAutomationInput, 'channelId'>;

/** Columns derived from the input; scope fields only apply to comment triggers. */
function toColumns(input: AutomationFields) {
  const isComment = input.triggerType === 'COMMENT';
  const postScope = isComment ? input.postScope : 'ANY';
  return {
    name: input.name,
    triggerType: input.triggerType,
    postScope,
    mediaIds: postScope === 'SPECIFIC' ? [...new Set(input.mediaIds)] : [],
    bufferPostId: postScope === 'BUFFER_POST' ? (input.bufferPostId ?? null) : null,
    matchMode: input.matchMode,
    keywords: input.matchMode === 'KEYWORDS' ? [...new Set(input.keywords)] : [],
    wholeWord: input.wholeWord,
    oncePerContact: input.oncePerContact,
    response: input.response as Prisma.InputJsonValue,
  };
}

@Injectable()
export class AutomationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly links: TrackedLinksService,
    private readonly audit: AuditService,
  ) {}

  async list(workspaceId: string): Promise<AutomationDto[]> {
    const automations = await this.prisma.automation.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
    const stats = await this.statsFor(automations.map((a) => a.id));
    return automations.map((a) => toDto(a, stats.get(a.id)));
  }

  async get(workspaceId: string, id: string): Promise<AutomationDto> {
    const automation = await this.find(workspaceId, id);
    const stats = await this.statsFor([automation.id]);
    return toDto(automation, stats.get(automation.id));
  }

  async create(workspaceId: string, actorId: string, input: CreateAutomationInput): Promise<AutomationDto> {
    await this.assertChannel(workspaceId, input.channelId);
    const columns = toColumns(input);
    const automation = await this.prisma.$transaction(async (tx) => {
      const created = await tx.automation.create({
        data: {
          ...columns,
          workspaceId,
          channelId: input.channelId,
          status: input.status,
          createdById: actorId,
          armedAt: input.status === 'ACTIVE' && columns.postScope === 'NEXT_POST' ? new Date() : null,
        },
      });
      await this.links.sync(tx, created, input.response.message.buttons);
      return created;
    });
    await this.audit.record({
      action: 'automation.created',
      actorId,
      workspaceId,
      targetType: 'automation',
      targetId: automation.id,
    });
    return toDto(automation);
  }

  async update(workspaceId: string, actorId: string, id: string, input: UpdateAutomationInput): Promise<AutomationDto> {
    const current = await this.find(workspaceId, id);
    if (input.channelId !== current.channelId) await this.assertChannel(workspaceId, input.channelId);
    const columns = toColumns(input);
    const scopeChanged =
      columns.postScope !== current.postScope || columns.bufferPostId !== current.bufferPostId;

    const automation = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.automation.update({
        where: { id },
        data: {
          ...columns,
          channelId: input.channelId,
          // A resolved "next post" keeps its post unless the scope itself changed.
          ...(scopeChanged ? { scopeResolvedAt: null, armedAt: current.status === 'ACTIVE' ? new Date() : null } : {}),
          ...(!scopeChanged && current.scopeResolvedAt ? { mediaIds: current.mediaIds } : {}),
        },
      });
      await this.links.sync(tx, updated, input.response.message.buttons);
      return updated;
    });
    await this.audit.record({
      action: 'automation.updated',
      actorId,
      workspaceId,
      targetType: 'automation',
      targetId: id,
    });
    return this.get(workspaceId, automation.id);
  }

  async setStatus(workspaceId: string, actorId: string, id: string, status: AutomationStatus): Promise<AutomationDto> {
    const current = await this.find(workspaceId, id);
    if (status === 'ACTIVE') {
      const channel = await this.prisma.channel.findUnique({ where: { id: current.channelId } });
      if (channel?.status !== 'ACTIVE') throw new AppException(ErrorCode.CHANNEL_NEEDS_REAUTH);
    }
    await this.prisma.automation.update({
      where: { id },
      data: {
        status,
        ...(status === 'ACTIVE' && current.postScope === 'NEXT_POST' && !current.armedAt ? { armedAt: new Date() } : {}),
      },
    });
    await this.audit.record({
      action: 'automation.status_changed',
      actorId,
      workspaceId,
      targetType: 'automation',
      targetId: id,
      metadata: { status },
    });
    return this.get(workspaceId, id);
  }

  async duplicate(workspaceId: string, actorId: string, id: string): Promise<AutomationDto> {
    const source = await this.get(workspaceId, id);
    return this.create(workspaceId, actorId, {
      ...source,
      name: `${source.name} (copy)`.slice(0, 80),
      status: 'DRAFT',
    });
  }

  async remove(workspaceId: string, actorId: string, id: string): Promise<void> {
    await this.find(workspaceId, id);
    await this.prisma.automation.delete({ where: { id } });
    await this.audit.record({
      action: 'automation.deleted',
      actorId,
      workspaceId,
      targetType: 'automation',
      targetId: id,
    });
  }

  private async find(workspaceId: string, id: string): Promise<Automation> {
    const automation = await this.prisma.automation.findFirst({ where: { id, workspaceId } });
    if (!automation) throw AppException.notFound();
    return automation;
  }

  private async assertChannel(workspaceId: string, channelId: string): Promise<void> {
    const channel = await this.prisma.channel.findFirst({ where: { id: channelId, workspaceId }, select: { id: true } });
    if (!channel) throw new AppException(ErrorCode.VALIDATION_FAILED, { channelId: ['not_found'] });
  }

  private async statsFor(ids: string[]): Promise<Map<string, AutomationStatsDto>> {
    const stats = new Map<string, AutomationStatsDto>();
    if (ids.length === 0) return stats;
    const [byStatus, clicks] = await Promise.all([
      this.prisma.delivery.groupBy({
        by: ['automationId', 'status'],
        where: { automationId: { in: ids } },
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<Array<{ automationId: string; clicks: bigint }>>`
        SELECT l."automationId", COUNT(DISTINCT c."visitorHash") AS clicks
        FROM "LinkClick" c JOIN "TrackedLink" l ON l.id = c."linkId"
        WHERE l."automationId" = ANY(${ids})
        GROUP BY l."automationId"`,
    ]);
    for (const row of byStatus) {
      const entry = stats.get(row.automationId) ?? { ...EMPTY_STATS };
      entry.triggered += row._count._all;
      if (row.status === 'SENT') entry.sent += row._count._all;
      if (row.status === 'FAILED') entry.failed += row._count._all;
      stats.set(row.automationId, entry);
    }
    for (const row of clicks) {
      const entry = stats.get(row.automationId) ?? { ...EMPTY_STATS };
      entry.clicks = Number(row.clicks);
      stats.set(row.automationId, entry);
    }
    return stats;
  }
}
