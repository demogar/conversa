import { Controller, Get, HttpCode, Module, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { type SendInboxMessageInput, sendInboxMessageSchema } from '@conversa/shared';
import { CurrentAuth, CurrentMembership } from '../../common/http/decorators.js';
import type { AuthContext, MembershipContext } from '../../common/http/request.js';
import { ZodBody } from '../../common/validation/zod.pipe.js';
import { AuditService } from '../audit/audit.service.js';
import { ChannelsModule } from '../channels/channels.module.js';
import { ChannelsService } from '../channels/channels.service.js';
import { ProviderRegistry } from '../channels/provider/provider.registry.js';

/**
 * A live view of the account's conversations, read from the platform on
 * demand. Conversa does not store message bodies it did not send.
 */
@Controller('workspaces/:workspaceId/channels/:channelId/conversations')
export class InboxController {
  constructor(
    private readonly channels: ChannelsService,
    private readonly providers: ProviderRegistry,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list(
    @CurrentMembership() membership: MembershipContext,
    @Param('channelId') channelId: string,
  ) {
    const { channel, session } = await this.channels.activeSession(
      membership.workspaceId,
      channelId,
    );
    const conversations = await this.channels.callProvider(channel, () =>
      this.providers.get(channel.type).listConversations(session),
    );
    // Some platforms (TikTok) do not name the other side; the contacts their webhooks created do.
    const unnamed = conversations.filter((c) => !c.participant.username && c.participant.id);
    if (unnamed.length === 0) return conversations;
    const usernames = await this.channels.contactUsernames(
      channel.id,
      unnamed.map((c) => c.participant.id),
    );
    return conversations.map((conversation) => ({
      ...conversation,
      participant: {
        ...conversation.participant,
        username:
          conversation.participant.username ?? usernames.get(conversation.participant.id) ?? null,
      },
    }));
  }

  @Get(':conversationId/messages')
  async messages(
    @CurrentMembership() membership: MembershipContext,
    @Param('channelId') channelId: string,
    @Param('conversationId') conversationId: string,
  ) {
    const { channel, session } = await this.channels.activeSession(
      membership.workspaceId,
      channelId,
    );
    return this.channels.callProvider(channel, () =>
      this.providers.get(channel.type).listMessages(session, conversationId),
    );
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post(':conversationId/messages/:recipientId')
  @HttpCode(204)
  async send(
    @CurrentAuth() auth: AuthContext,
    @CurrentMembership() membership: MembershipContext,
    @Param('channelId') channelId: string,
    @Param('recipientId') recipientId: string,
    @ZodBody(sendInboxMessageSchema) body: SendInboxMessageInput,
  ): Promise<void> {
    const { channel, session } = await this.channels.activeSession(
      membership.workspaceId,
      channelId,
    );
    await this.channels.callProvider(channel, () =>
      this.providers.get(channel.type).sendMessage(session, recipientId, { text: body.text }),
    );
    await this.audit.record({
      action: 'inbox.message_sent',
      actorId: auth.userId,
      workspaceId: membership.workspaceId,
      targetType: 'channel',
      targetId: channel.id,
    });
  }
}

@Module({ imports: [ChannelsModule], controllers: [InboxController] })
export class InboxModule {}
