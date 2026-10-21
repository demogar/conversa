import { Controller, Get, NotFoundException, Param, Query, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { ClientIp, Public } from '../../common/http/decorators.js';
import { TrackedLinksService } from './tracked-links.service.js';

@Controller('l')
export class LinksController {
  constructor(private readonly links: TrackedLinksService) {}

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get(':slug')
  async redirect(
    @Param('slug') slug: string,
    @Query('r') ref: unknown,
    @ClientIp() ip: string,
    @Res() response: Response,
  ): Promise<void> {
    const destination = await this.links.registerClick(slug, typeof ref === 'string' ? ref : undefined, ip);
    if (!destination) throw new NotFoundException();
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.redirect(302, destination);
  }
}
