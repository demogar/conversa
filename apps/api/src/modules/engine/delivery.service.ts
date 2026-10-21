import { randomInt } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import {
  type AutomationResponse,
  automationResponseSchema,
  renderTemplate,
} from '@conversa/shared';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { Automation, Channel, Contact, Delivery } from '../../generated/prisma/client.js';
import { ChannelsService } from '../channels/channels.service.js';
import type {
  ChannelProvider,
  ChannelSession,
  OutboundMessage,
} from '../channels/provider/channel-provider.js';
import { ProviderError } from '../channels/provider/channel-provider.js';
import { ProviderRegistry } from '../channels/provider/provider.registry.js';
import { TrackedLinksService } from '../links/tracked-links.service.js';
import { PostbackTokens } from './postback-token.js';
import { SendRateLimiter } from './send-rate-limiter.js';

/** How many times a contact who does not follow yet is asked again. */
export const MAX_FOLLOW_PROMPTS = 3;

export type StepOutcome = { type: 'done' } | { type: 'defer'; delayMs: number };

const DONE: StepOutcome = { type: 'done' };

type LoadedDelivery = Delivery & { automation: Automation; channel: Channel; contact: Contact };

interface StepContext {
  delivery: LoadedDelivery;
  response: AutomationResponse;
  provider: ChannelProvider;
  session: ChannelSession;
}

/**
 * Runs a delivery through its steps. Each step is safe to run again: it
 * checks the delivery's status first and moves it forward only after the
 * platform accepted the message, so a retried job never sends twice for a
 * step that already succeeded.
 *
 *   PENDING ──(no gate)──────────────────────────────▶ SENT
 *   PENDING ──(opening or follow gate)─▶ AWAITING_TAP
 *   AWAITING_TAP / AWAITING_FOLLOW ──tap──▶ follows? ─▶ SENT
 *                                              └─ no ─▶ AWAITING_FOLLOW
 */
@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProviderRegistry,
    private readonly channels: ChannelsService,
    private readonly links: TrackedLinksService,
    private readonly tokens: PostbackTokens,
    private readonly limiter: SendRateLimiter,
  ) {}

  async start(deliveryId: string): Promise<StepOutcome> {
    const context = await this.load(deliveryId, ['PENDING']);
    if (!context) return DONE;
    const { delivery, response, provider, session } = context;
    const isComment = delivery.automation.triggerType === 'COMMENT';
    const gate = response.opening.enabled
      ? response.opening
      : response.followGate.enabled
        ? response.followGate
        : null;

    if (isComment) {
      const slot = await this.limiter.takePrivateReplySlot(delivery.channelId);
      if (!slot.taken) return { type: 'defer', delayMs: slot.retryInMs };
    }

    if (!isComment && !delivery.contact.username && this.mentionsUsername(response)) {
      await this.refreshContact(context);
    }

    const message: OutboundMessage = gate
      ? this.gateMessage(delivery, gate)
      : await this.contentMessage(delivery, response);

    try {
      if (isComment) await provider.sendPrivateReply(session, delivery.triggerExternalId, message);
      else await provider.sendMessage(session, delivery.contact.externalId, message);
    } catch (error) {
      if (isComment && error instanceof ProviderError && error.kind !== 'transient') {
        await this.limiter.releasePrivateReplySlot(delivery.channelId);
      }
      throw error;
    }

    await this.prisma.delivery.update({
      where: { id: delivery.id },
      data: gate ? { status: 'AWAITING_TAP' } : { status: 'SENT', sentAt: new Date() },
    });

    if (isComment && response.publicReply.enabled && !delivery.publicReplySentAt) {
      await this.postPublicReply(context);
    }
    return DONE;
  }

  /** The contact tapped a button in the opening or follow-gate message. */
  async continueAfterTap(deliveryId: string): Promise<StepOutcome> {
    const context = await this.load(deliveryId, ['AWAITING_TAP', 'AWAITING_FOLLOW']);
    if (!context) return DONE;
    const { delivery, response, provider, session } = context;

    if (response.followGate.enabled) {
      const follows = await this.refreshContact(context);
      if (follows === false) {
        if (delivery.followPrompts >= MAX_FOLLOW_PROMPTS) return DONE;
        await provider.sendMessage(
          session,
          delivery.contact.externalId,
          this.gateMessage(delivery, response.followGate),
        );
        await this.prisma.delivery.update({
          where: { id: delivery.id },
          data: { status: 'AWAITING_FOLLOW', followPrompts: { increment: 1 } },
        });
        return DONE;
      }
      // Unknown follow status fails open: a real follower is never locked out.
    }

    await provider.sendMessage(
      session,
      delivery.contact.externalId,
      await this.contentMessage(delivery, response),
    );
    await this.prisma.delivery.update({
      where: { id: delivery.id },
      data: { status: 'SENT', sentAt: new Date() },
    });
    return DONE;
  }

  async markFailed(deliveryId: string, error: unknown): Promise<void> {
    const code = error instanceof ProviderError ? error.kind.toUpperCase() : 'INTERNAL';
    await this.prisma.delivery.updateMany({
      where: { id: deliveryId, status: { in: ['PENDING', 'AWAITING_TAP', 'AWAITING_FOLLOW'] } },
      data: {
        status: 'FAILED',
        errorCode: code,
        errorMessage:
          error instanceof Error ? error.message.slice(0, 1000) : String(error).slice(0, 1000),
      },
    });
  }

  async markSkipped(deliveryId: string, reason: string): Promise<void> {
    await this.prisma.delivery.updateMany({
      where: { id: deliveryId, status: 'PENDING' },
      data: { status: 'SKIPPED', skipReason: reason },
    });
  }

  private async load(
    deliveryId: string,
    statuses: Delivery['status'][],
  ): Promise<StepContext | null> {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { automation: true, channel: true, contact: true },
    });
    if (!delivery || !statuses.includes(delivery.status)) return null;

    if (delivery.channel.status !== 'ACTIVE') {
      await this.markSkipped(delivery.id, 'CHANNEL_INACTIVE');
      return null;
    }
    if (delivery.automation.status !== 'ACTIVE' && delivery.status === 'PENDING') {
      await this.markSkipped(delivery.id, 'AUTOMATION_PAUSED');
      return null;
    }

    const parsed = automationResponseSchema.safeParse(delivery.automation.response);
    if (!parsed.success) {
      await this.markFailed(delivery.id, new Error('The automation response is invalid'));
      return null;
    }
    await this.prisma.delivery.update({
      where: { id: delivery.id },
      data: { attempts: { increment: 1 } },
    });
    return {
      delivery,
      response: parsed.data,
      provider: this.providers.get(delivery.channel.type),
      session: this.channels.session(delivery.channel),
    };
  }

  private gateMessage(
    delivery: LoadedDelivery,
    gate: { text: string; buttonLabel: string },
  ): OutboundMessage {
    return {
      text: renderTemplate(gate.text, { username: delivery.contact.username }),
      buttons: [
        { type: 'postback', label: gate.buttonLabel, payload: this.tokens.create(delivery.id) },
      ],
    };
  }

  private async contentMessage(
    delivery: LoadedDelivery,
    response: AutomationResponse,
  ): Promise<OutboundMessage> {
    const slugs = response.message.buttons.length
      ? await this.links.slugsFor(delivery.automationId)
      : new Map();
    return {
      text: renderTemplate(response.message.text, { username: delivery.contact.username }),
      buttons: response.message.buttons.map((button, position) => {
        const slug = slugs.get(position);
        return {
          type: 'url',
          label: button.label,
          url: slug ? this.links.buildUrl(slug, delivery.id) : button.url,
        };
      }),
    };
  }

  /** Public replies are best effort: a failure is recorded but never fails the delivery. */
  private async postPublicReply({
    delivery,
    response,
    provider,
    session,
  }: StepContext): Promise<void> {
    const variants = response.publicReply.variants;
    const text = renderTemplate(variants[randomInt(variants.length)] ?? '', {
      username: delivery.contact.username,
    });
    if (!text) return;
    try {
      await provider.replyToComment(session, delivery.triggerExternalId, text);
      await this.prisma.delivery.update({
        where: { id: delivery.id },
        data: { publicReplySentAt: new Date() },
      });
    } catch (error) {
      if (error instanceof ProviderError && error.kind === 'auth') throw error;
      this.logger.warn({ err: error, deliveryId: delivery.id }, 'Public reply failed');
      await this.prisma.delivery.update({
        where: { id: delivery.id },
        data: { publicReplyError: (error as Error).message.slice(0, 500) },
      });
    }
  }

  private async refreshContact({
    delivery,
    provider,
    session,
  }: StepContext): Promise<boolean | null> {
    const profile = await provider.getContactProfile(session, delivery.contact.externalId);
    await this.prisma.contact.update({
      where: { id: delivery.contactId },
      data: {
        ...(profile.username ? { username: profile.username } : {}),
        ...(profile.follows !== null ? { isFollower: profile.follows } : {}),
      },
    });
    if (profile.username) delivery.contact.username = profile.username;
    return profile.follows;
  }

  private mentionsUsername(response: AutomationResponse): boolean {
    return [response.message.text, response.opening.text, response.followGate.text].some((text) =>
      text.includes('{username}'),
    );
  }
}
