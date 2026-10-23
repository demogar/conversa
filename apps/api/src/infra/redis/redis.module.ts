import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import { AppConfig } from '../../config/app-config.js';

export const REDIS = Symbol('REDIS');
export const InjectRedis = (): ParameterDecorator => Inject(REDIS);

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [AppConfig],
      useFactory: (config: AppConfig) =>
        new Redis(config.env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: false }),
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  // Not onModuleDestroy: that runs before the HTTP server and the queue workers
  // close, and requests still in flight would lose Valkey (503s).
  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit();
  }
}
