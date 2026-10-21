import { Module } from '@nestjs/common';
import { LinksModule } from '../links/links.module.js';
import { AutomationsController } from './automations.controller.js';
import { AutomationsService } from './automations.service.js';

@Module({
  imports: [LinksModule],
  controllers: [AutomationsController],
  providers: [AutomationsService],
})
export class AutomationsModule {}
