import { Controller, Get, HttpCode, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Redis } from 'ioredis';
import { Public } from '../../common/http/decorators.js';
import { BuildInfo } from '../../config/build-info.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { InjectRedis } from '../../infra/redis/redis.module.js';

@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
    private readonly build: BuildInfo,
  ) {}

  /** Liveness: the process is up, and which build it runs. */
  @Public()
  @Get()
  @HttpCode(200)
  live(): { status: 'ok'; version: string; commit: string | null } {
    return { status: 'ok', version: this.build.version, commit: this.build.commit };
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
