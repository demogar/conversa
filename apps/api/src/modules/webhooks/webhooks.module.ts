import { Module } from '@nestjs/common';
import { ChannelsModule } from '../channels/channels.module.js';
import { InboundEventIngestor } from './inbound-event.ingestor.js';
import { SetupStatusController } from './setup-status.controller.js';
import { WebhookStatusService } from './webhook-status.service.js';
import { WebhooksController } from './webhooks.controller.js';

@Module({
  imports: [ChannelsModule],
  controllers: [WebhooksController, SetupStatusController],
  providers: [InboundEventIngestor, WebhookStatusService],
  exports: [InboundEventIngestor],
})
export class WebhooksModule {}
