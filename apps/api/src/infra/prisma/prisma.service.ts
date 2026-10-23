import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { AppConfig } from '../../config/app-config.js';
import { PrismaClient } from '../../generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnApplicationShutdown {
  constructor(config: AppConfig) {
    super({
      adapter: new PrismaPg({
        connectionString: config.env.DATABASE_URL,
        max: config.env.DB_POOL_MAX,
        idleTimeoutMillis: 30_000,
      }),
    });
  }

  // Not onModuleDestroy: that runs before the HTTP server closes, and requests
  // still in flight would lose the database (503s).
  async onApplicationShutdown(): Promise<void> {
    await this.$disconnect();
  }
}
