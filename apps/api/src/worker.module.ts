import { Module } from '@nestjs/common';
import { EngineModule } from './modules/engine/engine.module.js';
import { MaintenanceModule } from './modules/maintenance/maintenance.module.js';

/** The queue processors: the automation engine and housekeeping. */
@Module({ imports: [EngineModule, MaintenanceModule] })
export class WorkerModule {}
