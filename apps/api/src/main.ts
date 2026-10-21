import './config/load-dotenv.js';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './bootstrap.js';
import { AppConfig } from './config/app-config.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    bufferLogs: true,
  });
  configureApp(app);
  app.enableShutdownHooks();

  await app.listen(app.get(AppConfig).env.API_PORT, '0.0.0.0');
}

await bootstrap();
