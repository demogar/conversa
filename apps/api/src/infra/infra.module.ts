import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { AppConfig } from '../config/app-config.js';
import { ConfigModule } from '../config/config.module.js';
import { CryptoModule } from '../common/crypto/crypto.module.js';
import { AuditModule } from '../modules/audit/audit.module.js';
import { MailModule } from './mail/mail.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { QueueModule } from './queue/queue.module.js';
import { RedisModule } from './redis/redis.module.js';

/** Paths whose values must never be written to logs. */
const REDACT = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-hub-signature-256"]',
  'res.headers["set-cookie"]',
  '*.password',
  '*.apiKey',
  '*.accessToken',
  '*.token',
  '*.code',
];

/** Shared by the API and the worker: configuration, logging, storage, queues. */
@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        pinoHttp: {
          level: config.env.LOG_LEVEL,
          redact: { paths: REDACT, censor: '[redacted]' },
          genReqId: (req, res) => {
            const id = randomUUID();
            res.setHeader('X-Request-Id', id);
            return id;
          },
          // Query strings can carry OAuth codes and tokens; log the path only.
          serializers: {
            req: (req: { id: string; method: string; url: string }) => ({
              id: req.id,
              method: req.method,
              path: req.url.split('?')[0],
            }),
            res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
          },
          autoLogging: { ignore: (req) => req.url?.startsWith('/api/v1/health') ?? false },
          transport: config.isProduction
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
        },
      }),
    }),
    CryptoModule,
    PrismaModule,
    RedisModule,
    QueueModule,
    MailModule,
    AuditModule,
  ],
})
export class InfraModule {}
