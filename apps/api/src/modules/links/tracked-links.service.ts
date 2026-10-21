import { randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { LinkButton } from '@conversa/shared';
import { AppConfig } from '../../config/app-config.js';
import { CryptoService, safeEqual } from '../../common/crypto/crypto.service.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';

const SLUG_ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SLUG_LENGTH = 9;

function newSlug(): string {
  return Array.from({ length: SLUG_LENGTH }, () => SLUG_ALPHABET[randomInt(SLUG_ALPHABET.length)]).join('');
}

/**
 * Every button link in an automation goes through a short redirect, so clicks
 * can be counted per automation and per delivery without third-party
 * trackers. Destinations live server-side: a slug can only ever redirect to a
 * URL an editor saved, which rules out open redirects.
 */
@Injectable()
export class TrackedLinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly config: AppConfig,
  ) {}

  /** Makes the automation's tracked links mirror its buttons, keeping slugs stable. */
  async sync(
    tx: Prisma.TransactionClient,
    automation: { id: string; workspaceId: string },
    buttons: readonly LinkButton[],
  ): Promise<void> {
    await tx.trackedLink.deleteMany({ where: { automationId: automation.id, position: { gte: buttons.length } } });
    for (const [position, button] of buttons.entries()) {
      await tx.trackedLink.upsert({
        where: { automationId_position: { automationId: automation.id, position } },
        create: {
          automationId: automation.id,
          workspaceId: automation.workspaceId,
          position,
          slug: newSlug(),
          label: button.label,
          destinationUrl: button.url,
        },
        update: { label: button.label, destinationUrl: button.url },
      });
    }
  }

  async slugsFor(automationId: string): Promise<Map<number, string>> {
    const links = await this.prisma.trackedLink.findMany({
      where: { automationId },
      select: { position: true, slug: true },
    });
    return new Map(links.map((link) => [link.position, link.slug]));
  }

  /** The public URL for a button, carrying a signed reference to the delivery. */
  buildUrl(slug: string, deliveryId: string): string {
    const ref = `${deliveryId}.${this.crypto.hmac('link-ref', deliveryId).slice(0, 16)}`;
    return this.config.url(`/l/${slug}?r=${encodeURIComponent(ref)}`);
  }

  /** Records a click and returns where to send the visitor, or null for an unknown slug. */
  async registerClick(slug: string, ref: string | undefined, ip: string): Promise<string | null> {
    if (!/^[A-Za-z0-9]{6,16}$/.test(slug)) return null;
    const link = await this.prisma.trackedLink.findUnique({ where: { slug } });
    if (!link) return null;

    let deliveryId: string | null = null;
    if (ref) {
      const [id, signature] = ref.split('.');
      if (id && signature && safeEqual(signature, this.crypto.hmac('link-ref', id).slice(0, 16))) {
        deliveryId = id;
      }
    }
    const delivery = deliveryId
      ? await this.prisma.delivery.findFirst({ where: { id: deliveryId, automationId: link.automationId }, select: { id: true } })
      : null;

    await this.prisma.linkClick.create({
      data: {
        linkId: link.id,
        deliveryId: delivery?.id ?? null,
        visitorHash: this.crypto.hmac('visitor', `${link.id}:${ip}`).slice(0, 32),
      },
    });
    return link.destinationUrl;
  }
}
