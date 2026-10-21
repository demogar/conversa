import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.js';
import { INBOUND_QUEUE, MAINTENANCE_QUEUE, OUTBOUND_QUEUE } from './queues.js';

const queues = BullModule.registerQueue(
  { name: INBOUND_QUEUE },
  { name: OUTBOUND_QUEUE },
  { name: MAINTENANCE_QUEUE },
);

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        connection: { url: config.env.REDIS_URL, maxRetriesPerRequest: null },
        prefix: 'conversa',
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: { age: 24 * 3600, count: 5_000 },
          removeOnFail: { age: 7 * 24 * 3600 },
        },
      }),
    }),
    queues,
  ],
  exports: [queues],
})
export class QueueModule {}
