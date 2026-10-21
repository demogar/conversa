import './config/load-dotenv.js';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { WorkerRootModule } from './worker-root.module.js';

/** The worker process: consumes the queues, serves no HTTP. */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerRootModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  app.get(Logger).log('Worker started');
}

await bootstrap();
