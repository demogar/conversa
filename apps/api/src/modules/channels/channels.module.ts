import { Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.js';
import { ChannelsController } from './channels.controller.js';
import { ChannelsService } from './channels.service.js';
import { InstagramGraphClient } from './instagram/instagram-graph.client.js';
import { InstagramProvider } from './instagram/instagram.provider.js';
import type { ChannelProvider } from './provider/channel-provider.js';
import { CHANNEL_PROVIDERS, ProviderRegistry } from './provider/provider.registry.js';
import { SandboxInstagramProvider } from './sandbox/sandbox-instagram.provider.js';
import { SandboxOutbox } from './sandbox/sandbox-outbox.js';
import { SandboxTikTokProvider } from './sandbox/sandbox-tiktok.provider.js';
import { TikTokApiClient } from './tiktok/tiktok-api.client.js';
import { TikTokProvider } from './tiktok/tiktok.provider.js';

/**
 * Registers the platform providers. A new platform is a new provider class
 * added to the CHANNEL_PROVIDERS factory below. With INSTAGRAM_SANDBOX on,
 * simulated platforms take the real ones' place.
 */
@Module({
  controllers: [ChannelsController],
  providers: [
    InstagramGraphClient,
    InstagramProvider,
    TikTokApiClient,
    TikTokProvider,
    SandboxOutbox,
    SandboxInstagramProvider,
    SandboxTikTokProvider,
    {
      provide: CHANNEL_PROVIDERS,
      inject: [
        AppConfig,
        InstagramProvider,
        TikTokProvider,
        SandboxInstagramProvider,
        SandboxTikTokProvider,
      ],
      useFactory: (
        config: AppConfig,
        instagram: InstagramProvider,
        tiktok: TikTokProvider,
        sandboxInstagram: SandboxInstagramProvider,
        sandboxTikTok: SandboxTikTokProvider,
      ) =>
        (config.sandbox
          ? [sandboxInstagram, sandboxTikTok]
          : [instagram, tiktok]) satisfies ChannelProvider[],
    },
    ProviderRegistry,
    ChannelsService,
  ],
  exports: [ProviderRegistry, ChannelsService, SandboxOutbox],
})
export class ChannelsModule {}
