import { Controller, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AppCredentialsCheck, InstagramSetupStatusDto } from '@conversa/shared';
import { AppConfig } from '../../config/app-config.js';
import { RequireInstanceAdmin } from '../../common/http/decorators.js';
import { ChannelsService } from '../channels/channels.service.js';
import { ProviderRegistry } from '../channels/provider/provider.registry.js';
import { InstanceSettingsService } from '../instance/instance-settings.service.js';
import { WebhookStatusService } from './webhook-status.service.js';

/** A definite answer from Meta holds until the settings change, or for this long. */
const CHECK_TTL_MS = 10 * 60_000;

/**
 * How far the Meta app setup has got: whether Meta accepts the stored app ID
 * and secret, and when its webhooks last reached this installation. The
 * answer never contains the credentials themselves.
 */
@RequireInstanceAdmin()
@Controller('instance/instagram')
export class SetupStatusController {
  private cached: { version: number; at: number; result: AppCredentialsCheck } | null = null;

  constructor(
    private readonly providers: ProviderRegistry,
    private readonly channels: ChannelsService,
    private readonly settings: InstanceSettingsService,
    private readonly webhooks: WebhookStatusService,
    private readonly config: AppConfig,
  ) {}

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('status')
  async status(): Promise<InstagramSetupStatusDto> {
    const [credentials, webhook] = await Promise.all([
      this.config.sandbox ? Promise.resolve<AppCredentialsCheck>('unknown') : this.credentials(),
      this.webhooks.get('INSTAGRAM'),
    ]);
    return {
      sandbox: this.config.sandbox,
      credentials,
      webhookVerifiedAt: webhook.verifiedAt?.toISOString() ?? null,
      lastEventAt: webhook.lastEventAt?.toISOString() ?? null,
    };
  }

  private async credentials(): Promise<AppCredentialsCheck> {
    if (!this.settings.instagram) return 'not_configured';
    const { version } = this.settings;
    const cached = this.cached;
    if (cached && cached.version === version && Date.now() - cached.at < CHECK_TTL_MS)
      return cached.result;

    const result = await this.providers
      .get('INSTAGRAM')
      .checkAppCredentials(this.channels.redirectUri('INSTAGRAM'));
    // "Unknown" is not cached, so the next look asks Meta again.
    this.cached = result === 'unknown' ? null : { version, at: Date.now(), result };
    return result;
  }
}
