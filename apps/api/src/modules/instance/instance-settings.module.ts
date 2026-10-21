import { Global, Module } from '@nestjs/common';
import { InstanceSettingsService } from './instance-settings.service.js';

/** Shared by the API and the worker, like the configuration it complements. */
@Global()
@Module({ providers: [InstanceSettingsService], exports: [InstanceSettingsService] })
export class InstanceSettingsModule {}
