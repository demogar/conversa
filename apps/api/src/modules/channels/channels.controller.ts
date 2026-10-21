import { Controller, Delete, Get, HttpCode, Logger, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { ChannelType, type ErrorCode } from '@conversa/shared';
import { AppConfig } from '../../config/app-config.js';
import { AppException } from '../../common/errors/app.exception.js';
import { CurrentAuth, CurrentMembership, RequireRole } from '../../common/http/decorators.js';
import type { AuthContext, MembershipContext } from '../../common/http/request.js';
import { ZodQuery } from '../../common/validation/zod.pipe.js';
import { ChannelsService } from './channels.service.js';

const channelType = z
  .string()
  .transform((value) => value.toUpperCase())
  .pipe(z.enum([ChannelType.INSTAGRAM]));

const mediaQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).default(30) });

@Controller()
export class ChannelsController {
  private readonly logger = new Logger(ChannelsController.name);

  constructor(
    private readonly channels: ChannelsService,
    private readonly config: AppConfig,
  ) {}

  @Get('workspaces/:workspaceId/channels')
  list(@CurrentMembership() membership: MembershipContext) {
    return this.channels.list(membership.workspaceId);
  }

  @Post('workspaces/:workspaceId/channels/:type/connect')
  @RequireRole('ADMIN')
  connect(
    @CurrentAuth() auth: AuthContext,
    @CurrentMembership() membership: MembershipContext,
    @Param('type') type: string,
  ): { url: string } {
    return this.channels.startConnect(membership.workspaceId, auth.userId, channelType.parse(type));
  }

  @Delete('workspaces/:workspaceId/channels/:channelId')
  @RequireRole('ADMIN')
  @HttpCode(204)
  async disconnect(
    @CurrentAuth() auth: AuthContext,
    @CurrentMembership() membership: MembershipContext,
    @Param('channelId') channelId: string,
  ): Promise<void> {
    await this.channels.disconnect(membership.workspaceId, channelId, auth.userId);
  }

  @Get('workspaces/:workspaceId/channels/:channelId/media')
  media(
    @CurrentMembership() membership: MembershipContext,
    @Param('channelId') channelId: string,
    @ZodQuery(mediaQuery) query: z.infer<typeof mediaQuery>,
  ) {
    return this.channels.listMedia(membership.workspaceId, channelId, query.limit);
  }

  /** The platform redirects the browser here after the person approves access. */
  @Get('channels/oauth/:type/callback')
  async callback(
    @CurrentAuth() auth: AuthContext,
    @Param('type') rawType: string,
    @Query('code') code: unknown,
    @Query('state') state: unknown,
    @Query('error') denied: unknown,
    @Res() response: Response,
  ): Promise<void> {
    const type = channelType.safeParse(rawType);
    if (!type.success || typeof state !== 'string') {
      response.redirect(303, this.config.url('/channels?error=TOKEN_INVALID'));
      return;
    }
    if (denied || typeof code !== 'string') {
      response.redirect(303, this.config.url('/channels?error=PROVIDER_ERROR'));
      return;
    }
    try {
      const channel = await this.channels.completeConnect(type.data, code, state, auth.userId);
      response.redirect(
        303,
        this.config.url(`/w/${channel.workspaceId}/channels?connected=${channel.id}`),
      );
    } catch (error) {
      const errorCode: ErrorCode = error instanceof AppException ? error.code : 'INTERNAL';
      if (!(error instanceof AppException))
        this.logger.error({ err: error }, 'Channel connection failed');
      response.redirect(303, this.config.url(`/channels?error=${errorCode}`));
    }
  }
}
