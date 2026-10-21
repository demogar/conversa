import { Module } from '@nestjs/common';
import { ChannelsModule } from '../channels/channels.module.js';
import { TrackedLinksModule } from '../links/links.module.js';
import { DeliveryService } from './delivery.service.js';
import { InboundEventHandler } from './inbound-event.handler.js';
import { InboundProcessor } from './inbound.processor.js';
import { OutboundProcessor } from './outbound.processor.js';
import { PostbackTokens } from './postback-token.js';
import { ScopeResolver } from './scope-resolver.js';
import { SendRateLimiter } from './send-rate-limiter.js';

/** The automation engine: runs in the worker process. */
@Module({
  imports: [ChannelsModule, TrackedLinksModule],
  providers: [
    InboundProcessor,
    OutboundProcessor,
    InboundEventHandler,
    DeliveryService,
    ScopeResolver,
    PostbackTokens,
    SendRateLimiter,
  ],
  exports: [ScopeResolver],
})
export class EngineModule {}
