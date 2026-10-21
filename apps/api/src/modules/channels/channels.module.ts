import { Module } from '@nestjs/common';
import { ChannelsController } from './channels.controller.js';
import { ChannelsService } from './channels.service.js';
import { InstagramGraphClient } from './instagram/instagram-graph.client.js';
import { InstagramProvider } from './instagram/instagram.provider.js';
import type { ChannelProvider } from './provider/channel-provider.js';
import { CHANNEL_PROVIDERS, ProviderRegistry } from './provider/provider.registry.js';

/**
 * Registers the platform providers. A new platform is a new provider class
 * added to the CHANNEL_PROVIDERS factory below.
 */
@Module({
  controllers: [ChannelsController],
  providers: [
    InstagramGraphClient,
    InstagramProvider,
    {
      provide: CHANNEL_PROVIDERS,
      inject: [InstagramProvider],
      useFactory: (...providers: ChannelProvider[]) => providers,
    },
    ProviderRegistry,
    ChannelsService,
  ],
  exports: [ProviderRegistry, ChannelsService],
})
export class ChannelsModule {}
