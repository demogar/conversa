import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { ChannelType } from '@conversa/shared';
import { isUniqueViolation } from '../../infra/prisma/errors.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { OUTBOUND_QUEUE, type OutboundJob } from '../../infra/queue/queues.js';
import type { Channel, Contact, TriggerType } from '../../generated/prisma/client.js';
import type {
  InboundCommentEvent,
  InboundEvent,
  InboundMessageEvent,
  InboundPostbackEvent,
} from '../channels/provider/channel-provider.js';
import { selectAutomation } from './automation-selector.js';
import { PostbackTokens } from './postback-token.js';
import { ScopeResolver } from './scope-resolver.js';

/** Statuses that count as "already answered" for once-per-contact automations. */
const ANSWERED = ['PENDING', 'AWAITING_TAP', 'AWAITING_FOLLOW', 'SENT'] as const;

/**
 * Turns a normalised platform event into work: it records the contact, picks
 * the automation that answers, creates the delivery and queues its first step.
 * Returns whether the event led to any work.
 */
@Injectable()
export class InboundEventHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopes: ScopeResolver,
    private readonly tokens: PostbackTokens,
    @InjectQueue(OUTBOUND_QUEUE) private readonly outbound: Queue<OutboundJob>,
  ) {}

  async handle(type: ChannelType, event: InboundEvent): Promise<boolean> {
    const channel = await this.prisma.channel.findUnique({
      where: { type_externalId: { type, externalId: event.accountExternalId } },
    });
    if (!channel) return false;
    await this.touchChannel(channel);
    if (channel.status !== 'ACTIVE') return false;

    switch (event.kind) {
      case 'comment':
        return this.onComment(channel, event);
      case 'message':
        return this.onMessage(channel, event);
      case 'postback':
        return this.onPostback(channel, event);
    }
  }

  private async onComment(channel: Channel, event: InboundCommentEvent): Promise<boolean> {
    const contact = await this.touchContact(
      channel,
      event.author.externalId,
      event.author.username,
    );
    const candidates = await this.activeAutomations(channel.id, 'COMMENT');
    if (candidates.length === 0) return false;
    const [mediaId] = event.mediaIds;
    if (mediaId) await this.scopes.resolveForComment(channel, candidates, mediaId);

    const selection = selectAutomation(candidates, { text: event.text, mediaIds: event.mediaIds });
    if (!selection) return false;
    return this.createDelivery(
      channel,
      contact,
      selection.automation,
      event.commentId,
      event.text,
      selection.matchedKeyword,
    );
  }

  private async onMessage(channel: Channel, event: InboundMessageEvent): Promise<boolean> {
    const contact = await this.touchContact(
      channel,
      event.sender.externalId,
      event.sender.username ?? null,
      event.sender.follows,
    );
    const candidates = await this.activeAutomations(channel.id, 'MESSAGE');
    const selection = selectAutomation(candidates, { text: event.text });
    if (!selection) return false;
    return this.createDelivery(
      channel,
      contact,
      selection.automation,
      event.messageId,
      event.text,
      selection.matchedKeyword,
    );
  }

  private async onPostback(channel: Channel, event: InboundPostbackEvent): Promise<boolean> {
    const deliveryId = this.tokens.read(event.payload);
    if (!deliveryId) return false;
    const delivery = await this.prisma.delivery.findFirst({
      where: {
        id: deliveryId,
        channelId: channel.id,
        contact: { externalId: event.sender.externalId },
      },
      select: { id: true, status: true, followPrompts: true },
    });
    if (!delivery || (delivery.status !== 'AWAITING_TAP' && delivery.status !== 'AWAITING_FOLLOW'))
      return false;
    await this.touchContact(
      channel,
      event.sender.externalId,
      event.sender.username ?? null,
      event.sender.follows,
    );
    // One job per delivery state: repeated taps on the same message collapse into one.
    await this.outbound.add(
      'tap',
      { kind: 'postback', deliveryId },
      { jobId: `tap-${delivery.id}-${delivery.status}-${delivery.followPrompts}` },
    );
    return true;
  }

  private activeAutomations(channelId: string, triggerType: TriggerType) {
    return this.prisma.automation.findMany({ where: { channelId, triggerType, status: 'ACTIVE' } });
  }

  private async createDelivery(
    channel: Channel,
    contact: Contact,
    automation: { id: string; oncePerContact: boolean },
    triggerExternalId: string,
    triggerText: string,
    matchedKeyword: string | null,
  ): Promise<boolean> {
    if (automation.oncePerContact) {
      const answered = await this.prisma.delivery.findFirst({
        where: {
          automationId: automation.id,
          contactId: contact.id,
          status: { in: [...ANSWERED] },
        },
        select: { id: true },
      });
      if (answered) return false;
    }

    let deliveryId: string;
    try {
      ({ id: deliveryId } = await this.prisma.delivery.create({
        data: {
          workspaceId: channel.workspaceId,
          automationId: automation.id,
          channelId: channel.id,
          contactId: contact.id,
          triggerExternalId,
          triggerText: triggerText.slice(0, 2_200),
          matchedKeyword,
        },
        select: { id: true },
      }));
    } catch (error) {
      // The platform redelivered a webhook we already acted on.
      if (isUniqueViolation(error)) return false;
      throw error;
    }
    await this.outbound.add(
      'start',
      { kind: 'start', deliveryId },
      { jobId: `start-${deliveryId}` },
    );
    return true;
  }

  /** Notes that the platform reached this account, at most once a minute. */
  private async touchChannel(channel: Channel): Promise<void> {
    const now = new Date();
    if (channel.lastEventAt && now.getTime() - channel.lastEventAt.getTime() < 60_000) return;
    await this.prisma.channel.updateMany({
      where: { id: channel.id },
      data: { lastEventAt: now },
    });
  }

  /** `follows` comes from platforms that report it in the event; undefined or null leaves it as is. */
  private touchContact(
    channel: Channel,
    externalId: string,
    username: string | null,
    follows?: boolean | null,
  ): Promise<Contact> {
    const now = new Date();
    const isFollower = typeof follows === 'boolean' ? { isFollower: follows } : {};
    return this.prisma.contact.upsert({
      where: { channelId_externalId: { channelId: channel.id, externalId } },
      create: {
        workspaceId: channel.workspaceId,
        channelId: channel.id,
        externalId,
        username,
        interactions: 1,
        ...isFollower,
      },
      update: {
        lastInteractionAt: now,
        interactions: { increment: 1 },
        ...(username ? { username } : {}),
        ...isFollower,
      },
    });
  }
}
