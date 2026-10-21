import './config/load-dotenv.js';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './bootstrap.js';
import { AppConfig } from './config/app-config.js';
import { BuildInfo } from './config/build-info.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    bufferLogs: true,
  });
  configureApp(app);
  app.enableShutdownHooks();

  const port = app.get(AppConfig).env.API_PORT;
  await app.listen(port, '0.0.0.0');
  app.get(Logger).log(`Conversa API ${app.get(BuildInfo).label} listening on port ${port}`);
}

await bootstrap();
