import { Module } from '@nestjs/common';
import { ChannelsModule } from '../channels/channels.module.js';
import { InboundEventIngestor } from './inbound-event.ingestor.js';
import { WebhooksController } from './webhooks.controller.js';

@Module({
  imports: [ChannelsModule],
  controllers: [WebhooksController],
  providers: [InboundEventIngestor],
  exports: [InboundEventIngestor],
})
export class WebhooksModule {}
