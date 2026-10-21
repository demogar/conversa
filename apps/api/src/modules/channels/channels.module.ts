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

/**
 * Registers the platform providers. A new platform is a new provider class
 * added to the CHANNEL_PROVIDERS factory below. With INSTAGRAM_SANDBOX on,
 * the simulated Instagram takes the real one's place.
 */
@Module({
  controllers: [ChannelsController],
  providers: [
    InstagramGraphClient,
    InstagramProvider,
    SandboxOutbox,
    SandboxInstagramProvider,
    {
      provide: CHANNEL_PROVIDERS,
      inject: [AppConfig, InstagramProvider, SandboxInstagramProvider],
      useFactory: (config: AppConfig, instagram: InstagramProvider, sandbox: SandboxInstagramProvider) => [
        config.sandbox ? sandbox : instagram,
      ] satisfies ChannelProvider[],
    },
    ProviderRegistry,
    ChannelsService,
  ],
  exports: [ProviderRegistry, ChannelsService, SandboxOutbox],
})
export class ChannelsModule {}
