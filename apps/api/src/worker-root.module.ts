import { Module } from '@nestjs/common';
import { InfraModule } from './infra/infra.module.js';
import { WorkerModule } from './worker.module.js';

@Module({ imports: [InfraModule, WorkerModule] })
export class WorkerRootModule {}
