import { Module } from '@nestjs/common';
import { PostbackTokensModule } from '../../engine/postback-token.js';
import { WebhooksModule } from '../../webhooks/webhooks.module.js';
import { ChannelsModule } from '../channels.module.js';
import { SandboxController } from './sandbox.controller.js';
import { SandboxService } from './sandbox.service.js';

/** The simulated Instagram's endpoints. Answer 404 unless INSTAGRAM_SANDBOX is on. */
@Module({
  imports: [ChannelsModule, WebhooksModule, PostbackTokensModule],
  controllers: [SandboxController],
  providers: [SandboxService],
})
export class SandboxModule {}
