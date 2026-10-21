import { Controller, Get, HttpCode, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Redis } from 'ioredis';
import { Public } from '../../common/http/decorators.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { InjectRedis } from '../../infra/redis/redis.module.js';

@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  /** Liveness: the process is up. */
  @Public()
  @Get()
  @HttpCode(200)
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /** Readiness: the database and Redis answer. */
  @Public()
  @Get('ready')
  async ready(): Promise<{ status: 'ok' }> {
    try {
      await Promise.all([this.prisma.$queryRaw`SELECT 1`, this.redis.ping()]);
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException();
    }
  }
}
