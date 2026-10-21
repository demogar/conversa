import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { z } from 'zod';
import { DeliveryStatus, type DeliveryDto, type Page } from '@conversa/shared';
import { CurrentMembership } from '../../common/http/decorators.js';
import type { MembershipContext } from '../../common/http/request.js';
import { ZodQuery } from '../../common/validation/zod.pipe.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';

const activityQuery = z.object({
  cursor: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  automationId: z.string().max(64).optional(),
  status: z.enum(Object.values(DeliveryStatus) as [DeliveryStatus, ...DeliveryStatus[]]).optional(),
});
type ActivityQuery = z.infer<typeof activityQuery>;

/** The log of every automation run: what fired, for whom, and how it ended. */
@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async list(workspaceId: string, query: ActivityQuery): Promise<Page<DeliveryDto>> {
    const rows = await this.prisma.delivery.findMany({
      where: {
        workspaceId,
        ...(query.automationId ? { automationId: query.automationId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: {
        automation: { select: { name: true } },
        contact: { select: { id: true, username: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const items = rows.slice(0, query.limit).map((d) => ({
      id: d.id,
      automationId: d.automationId,
      automationName: d.automation.name,
      channelId: d.channelId,
      contact: d.contact,
      triggerText: d.triggerText,
      matchedKeyword: d.matchedKeyword,
      status: d.status,
      skipReason: d.skipReason,
      errorCode: d.errorCode,
      publicReplySent: d.publicReplySentAt !== null,
      attempts: d.attempts,
      createdAt: d.createdAt.toISOString(),
      sentAt: d.sentAt?.toISOString() ?? null,
    }));
    return { items, nextCursor: rows.length > query.limit ? (items.at(-1)?.id ?? null) : null };
  }
}

@Controller('workspaces/:workspaceId/activity')
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  list(
    @CurrentMembership() membership: MembershipContext,
    @ZodQuery(activityQuery) query: ActivityQuery,
  ) {
    return this.activity.list(membership.workspaceId, query);
  }
}

@Module({ controllers: [ActivityController], providers: [ActivityService] })
export class ActivityModule {}
