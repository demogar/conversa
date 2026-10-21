import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { z } from 'zod';
import type { DashboardDto } from '@conversa/shared';
import { CurrentMembership } from '../../common/http/decorators.js';
import type { MembershipContext } from '../../common/http/request.js';
import { ZodQuery } from '../../common/validation/zod.pipe.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';

const dashboardQuery = z.object({ days: z.coerce.number().int().min(1).max(90).default(30) });

interface DailyRow {
  date: Date;
  sent: bigint;
  failed: bigint;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async get(workspaceId: string, days: number): Promise<DashboardDto> {
    const to = new Date();
    const from = new Date(to.getTime() - days * 86_400_000);
    const window = { workspaceId, createdAt: { gte: from } };

    const [byStatus, contacts, activeAutomations, channels, daily, dailyClicks, top, clicks] =
      await Promise.all([
        this.prisma.delivery.groupBy({ by: ['status'], where: window, _count: { _all: true } }),
        this.prisma.contact.count({ where: { workspaceId, lastInteractionAt: { gte: from } } }),
        this.prisma.automation.count({ where: { workspaceId, status: 'ACTIVE' } }),
        this.prisma.channel.count({ where: { workspaceId, status: { not: 'DISCONNECTED' } } }),
        this.prisma.$queryRaw<DailyRow[]>`
        SELECT date_trunc('day', "createdAt") AS date,
               COUNT(*) FILTER (WHERE status = 'SENT') AS sent,
               COUNT(*) FILTER (WHERE status = 'FAILED') AS failed
        FROM "Delivery" WHERE "workspaceId" = ${workspaceId} AND "createdAt" >= ${from}
        GROUP BY 1 ORDER BY 1`,
        this.prisma.$queryRaw<Array<{ date: Date; clicks: bigint }>>`
        SELECT date_trunc('day', c."createdAt") AS date, COUNT(DISTINCT c."visitorHash") AS clicks
        FROM "LinkClick" c JOIN "TrackedLink" l ON l.id = c."linkId"
        WHERE l."workspaceId" = ${workspaceId} AND c."createdAt" >= ${from}
        GROUP BY 1 ORDER BY 1`,
        this.prisma.$queryRaw<Array<{ id: string; name: string; sent: bigint; clicks: bigint }>>`
        SELECT a.id, a.name,
               (SELECT COUNT(*) FROM "Delivery" d WHERE d."automationId" = a.id AND d.status = 'SENT' AND d."createdAt" >= ${from}) AS sent,
               (SELECT COUNT(DISTINCT c."visitorHash") FROM "LinkClick" c JOIN "TrackedLink" l ON l.id = c."linkId"
                 WHERE l."automationId" = a.id AND c."createdAt" >= ${from}) AS clicks
        FROM "Automation" a WHERE a."workspaceId" = ${workspaceId}
        ORDER BY sent DESC, a."createdAt" DESC LIMIT 5`,
        this.prisma.$queryRaw<Array<{ clicks: bigint }>>`
        SELECT COUNT(DISTINCT c."visitorHash") AS clicks
        FROM "LinkClick" c JOIN "TrackedLink" l ON l.id = c."linkId"
        WHERE l."workspaceId" = ${workspaceId} AND c."createdAt" >= ${from}`,
      ]);

    const count = (status: string) =>
      byStatus.find((row) => row.status === status)?._count._all ?? 0;
    const dayKey = (date: Date) => date.toISOString().slice(0, 10);
    const clicksByDay = new Map(dailyClicks.map((row) => [dayKey(row.date), Number(row.clicks)]));
    const rowsByDay = new Map(daily.map((row) => [dayKey(row.date), row]));
    const series: DashboardDto['daily'] = [];
    for (let i = days - 1; i >= 0; i--) {
      const key = dayKey(new Date(to.getTime() - i * 86_400_000));
      const row = rowsByDay.get(key);
      series.push({
        date: key,
        sent: Number(row?.sent ?? 0),
        failed: Number(row?.failed ?? 0),
        clicks: clicksByDay.get(key) ?? 0,
      });
    }

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      totals: {
        triggered: byStatus.reduce((sum, row) => sum + row._count._all, 0),
        sent: count('SENT'),
        failed: count('FAILED'),
        clicks: Number(clicks[0]?.clicks ?? 0),
        contacts,
      },
      activeAutomations,
      channels,
      daily: series,
      topAutomations: top.map((row) => ({
        id: row.id,
        name: row.name,
        sent: Number(row.sent),
        clicks: Number(row.clicks),
      })),
    };
  }
}

@Controller('workspaces/:workspaceId/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  get(
    @CurrentMembership() membership: MembershipContext,
    @ZodQuery(dashboardQuery) query: z.infer<typeof dashboardQuery>,
  ) {
    return this.dashboard.get(membership.workspaceId, query.days);
  }
}

@Module({ controllers: [DashboardController], providers: [DashboardService] })
export class DashboardModule {}
