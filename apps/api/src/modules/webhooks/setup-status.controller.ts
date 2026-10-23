import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AppCredentialsCheck, ChannelType, PlatformSetupStatusDto } from '@conversa/shared';
import { AppConfig } from '../../config/app-config.js';
import { RequireInstanceAdmin } from '../../common/http/decorators.js';
import { ChannelsService } from '../channels/channels.service.js';
import { ProviderRegistry } from '../channels/provider/provider.registry.js';
import { InstanceSettingsService } from '../instance/instance-settings.service.js';
import { WebhookStatusService } from './webhook-status.service.js';

/** A definite answer from the platform holds until the settings change, or for this long. */
const CHECK_TTL_MS = 10 * 60_000;

const PLATFORMS: Record<string, ChannelType> = { instagram: 'INSTAGRAM', tiktok: 'TIKTOK' };

/**
 * How far a platform app's setup has got: whether the platform accepts the
 * stored app ID and secret, and when its webhooks last reached this
 * installation. The answer never contains the credentials themselves.
 */
@RequireInstanceAdmin()
@Controller('instance')
export class SetupStatusController {
  private readonly cached = new Map<
    ChannelType,
    { version: number; at: number; result: AppCredentialsCheck }
  >();

  constructor(
    private readonly providers: ProviderRegistry,
    private readonly channels: ChannelsService,
    private readonly settings: InstanceSettingsService,
    private readonly webhooks: WebhookStatusService,
    private readonly config: AppConfig,
  ) {}

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get(':platform/status')
  async status(@Param('platform') platform: string): Promise<PlatformSetupStatusDto> {
    const type = Object.hasOwn(PLATFORMS, platform) ? PLATFORMS[platform] : undefined;
    if (!type) throw new NotFoundException();
    const [credentials, webhook] = await Promise.all([
      this.config.sandbox
        ? Promise.resolve<AppCredentialsCheck>('unknown')
        : this.credentials(type),
      this.webhooks.get(type),
    ]);
    return {
      sandbox: this.config.sandbox,
      credentials,
      webhookVerifiedAt: webhook.verifiedAt?.toISOString() ?? null,
      lastEventAt: webhook.lastEventAt?.toISOString() ?? null,
    };
  }

  private async credentials(type: ChannelType): Promise<AppCredentialsCheck> {
    const provider = this.providers.get(type);
    if (!provider.isConfigured()) return 'not_configured';
    const { version } = this.settings;
    const cached = this.cached.get(type);
    if (cached && cached.version === version && Date.now() - cached.at < CHECK_TTL_MS)
      return cached.result;

    const result = await provider.checkAppCredentials(this.channels.redirectUri(type));
    // "Unknown" is not cached, so the next look asks the platform again.
    if (result === 'unknown') this.cached.delete(type);
    else this.cached.set(type, { version, at: Date.now(), result });
    return result;
  }
}
