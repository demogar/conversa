import { Global, Module } from '@nestjs/common';
import { AppConfig } from './app-config.js';
import { loadEnv } from './env.js';

@Global()
@Module({
  providers: [{ provide: AppConfig, useFactory: () => new AppConfig(loadEnv()) }],
  exports: [AppConfig],
})
export class ConfigModule {}
