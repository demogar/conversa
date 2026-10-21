import './config/load-dotenv.js';
import { RequestMethod } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { AppConfig } from './config/app-config.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true, bufferLogs: true });
  const config = app.get(AppConfig);
  app.useLogger(app.get(Logger));

  app.disable('x-powered-by');
  if (typeof config.env.TRUST_PROXY === 'number') app.set('trust proxy', config.env.TRUST_PROXY);
  app.use(
    helmet({
      // The API serves JSON and redirects only, so nothing may load or frame it.
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
      hsts: config.secureCookies,
    }),
  );
  app.use(cookieParser());
  app.useBodyParser('json', { limit: '256kb' });
  app.useBodyParser('urlencoded', { extended: false, limit: '64kb' });
  app.setGlobalPrefix('api/v1', { exclude: [{ path: 'l/:slug', method: RequestMethod.GET }] });
  app.enableShutdownHooks();

  await app.listen(config.env.API_PORT, '0.0.0.0');
}

await bootstrap();
