import { Module } from '@nestjs/common';
import { ChannelsModule } from '../channels/channels.module.js';
import { BufferClient } from './buffer.client.js';
import { BufferController } from './buffer.controller.js';
import { BufferService } from './buffer.service.js';

@Module({
  imports: [ChannelsModule],
  controllers: [BufferController],
  providers: [BufferClient, BufferService],
  exports: [BufferService],
})
export class BufferModule {}

/** The service alone, for the worker's sync job. */
@Module({
  imports: [ChannelsModule],
  providers: [BufferClient, BufferService],
  exports: [BufferService],
})
export class BufferSyncModule {}
