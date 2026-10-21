import { Module } from '@nestjs/common';
import { ChannelsModule } from '../channels/channels.module.js';
import { WebhooksController } from './webhooks.controller.js';

@Module({ imports: [ChannelsModule], controllers: [WebhooksController] })
export class WebhooksModule {}
