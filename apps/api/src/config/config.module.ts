import { Global, Module } from '@nestjs/common';
import { AppConfig } from './app-config.js';
import { BuildInfo } from './build-info.js';
import { loadEnv } from './env.js';

@Global()
@Module({
  providers: [
    { provide: AppConfig, useFactory: () => new AppConfig(loadEnv()) },
    { provide: BuildInfo, useFactory: () => BuildInfo.load() },
  ],
  exports: [AppConfig, BuildInfo],
})
export class ConfigModule {}
