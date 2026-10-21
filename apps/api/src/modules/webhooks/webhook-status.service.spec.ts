import type { PrismaService } from '../../infra/prisma/prisma.service.js';
import { WebhookStatusService } from './webhook-status.service.js';

function fakePrisma() {
  const writes: Array<Record<string, unknown>> = [];
  const prisma = {
    webhookStatus: {
      upsert: async ({ update }: { update: Record<string, unknown> }) => {
        writes.push(update);
        return {};
      },
    },
  };
  return { prisma: prisma as unknown as PrismaService, writes };
}

describe('WebhookStatusService', () => {
  it('records every successful verification', async () => {
    const { prisma, writes } = fakePrisma();
    const service = new WebhookStatusService(prisma);
    await service.recordVerified('INSTAGRAM', new Date('2026-10-01T10:00:00Z'));
    await service.recordVerified('INSTAGRAM', new Date('2026-10-01T10:00:01Z'));
    expect(writes).toHaveLength(2);
  });

  it('writes the last event at most once every 30 seconds', async () => {
    const { prisma, writes } = fakePrisma();
    const service = new WebhookStatusService(prisma);
    await service.recordEvent('INSTAGRAM', new Date('2026-10-01T10:00:00Z'));
    await service.recordEvent('INSTAGRAM', new Date('2026-10-01T10:00:10Z'));
    await service.recordEvent('INSTAGRAM', new Date('2026-10-01T10:00:31Z'));
    expect(writes).toEqual([
      { lastEventAt: new Date('2026-10-01T10:00:00Z') },
      { lastEventAt: new Date('2026-10-01T10:00:31Z') },
    ]);
  });

  it('never fails the webhook when the write does', async () => {
    const prisma = {
      webhookStatus: {
        upsert: async () => {
          throw new Error('connection lost');
        },
      },
    } as unknown as PrismaService;
    const service = new WebhookStatusService(prisma);
    // Quiet the expected warning.
    Object.assign(service, { logger: { warn: () => undefined } });
    await expect(service.recordEvent('INSTAGRAM')).resolves.toBeUndefined();
  });
});
