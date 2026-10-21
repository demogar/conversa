import { Module } from '@nestjs/common';
import { BufferSyncModule } from '../buffer/buffer.module.js';
import { ChannelsModule } from '../channels/channels.module.js';
import { EngineModule } from '../engine/engine.module.js';
import { MaintenanceProcessor } from './maintenance.processor.js';

@Module({ imports: [ChannelsModule, EngineModule, BufferSyncModule], providers: [MaintenanceProcessor] })
export class MaintenanceModule {}
