import { RequestMethod } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppConfig } from './config/app-config.js';

/**
 * The HTTP setup every API instance gets: logging, security headers, cookies,
 * body limits and the route prefix. Shared by main.ts and the integration
 * tests, so the tests exercise the real middleware.
 */
export function configureApp(app: NestExpressApplication): void {
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
}
