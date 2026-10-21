import { Module } from '@nestjs/common';
import { LinksController } from './links.controller.js';
import { TrackedLinksService } from './tracked-links.service.js';

@Module({ controllers: [LinksController], providers: [TrackedLinksService], exports: [TrackedLinksService] })
export class LinksModule {}

/** The same service without the redirect route, for the worker process. */
@Module({ providers: [TrackedLinksService], exports: [TrackedLinksService] })
export class TrackedLinksModule {}
