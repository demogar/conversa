import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { z } from 'zod';
import type { ContactDto, Page } from '@conversa/shared';
import { CurrentMembership } from '../../common/http/decorators.js';
import type { MembershipContext } from '../../common/http/request.js';
import { ZodQuery } from '../../common/validation/zod.pipe.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';

const contactsQuery = z.object({
  cursor: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  channelId: z.string().max(64).optional(),
  search: z.string().trim().max(60).optional(),
});
type ContactsQuery = z.infer<typeof contactsQuery>;

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(workspaceId: string, query: ContactsQuery): Promise<Page<ContactDto>> {
    const rows = await this.prisma.contact.findMany({
      where: {
        workspaceId,
        ...(query.channelId ? { channelId: query.channelId } : {}),
        ...(query.search ? { username: { contains: query.search.replace(/^@/, ''), mode: 'insensitive' } } : {}),
      },
      orderBy: [{ lastInteractionAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const items = rows.slice(0, query.limit).map((c) => ({
      id: c.id,
      channelId: c.channelId,
      externalId: c.externalId,
      username: c.username,
      interactions: c.interactions,
      isFollower: c.isFollower,
      firstSeenAt: c.firstSeenAt.toISOString(),
      lastInteractionAt: c.lastInteractionAt.toISOString(),
    }));
    return { items, nextCursor: rows.length > query.limit ? (items.at(-1)?.id ?? null) : null };
  }
}

@Controller('workspaces/:workspaceId/contacts')
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  list(@CurrentMembership() membership: MembershipContext, @ZodQuery(contactsQuery) query: ContactsQuery) {
    return this.contacts.list(membership.workspaceId, query);
  }
}

@Module({ controllers: [ContactsController], providers: [ContactsService] })
export class ContactsModule {}
