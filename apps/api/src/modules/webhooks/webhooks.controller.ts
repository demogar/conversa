import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AppConfig } from '../../config/app-config.js';
import { CryptoService } from '../../common/crypto/crypto.service.js';
import { Public, SkipOriginCheck } from '../../common/http/decorators.js';
import type { AppRequest } from '../../common/http/request.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { InstanceSettingsService } from '../instance/instance-settings.service.js';
import { ChannelsService } from '../channels/channels.service.js';
import { ProviderRegistry } from '../channels/provider/provider.registry.js';
import { InboundEventIngestor } from './inbound-event.ingestor.js';
import { parseSignedRequest } from './signed-request.js';

/**
 * Platform webhooks. The handler only verifies, stores and enqueues; all
 * matching and sending happens in the worker, so the platform always gets a
 * fast 200 and a redelivery never races a half-finished request.
 */
@Public()
@SkipOriginCheck()
@SkipThrottle()
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly providers: ProviderRegistry,
    private readonly prisma: PrismaService,
    private readonly channels: ChannelsService,
    private readonly crypto: CryptoService,
    private readonly config: AppConfig,
    private readonly ingestor: InboundEventIngestor,
    private readonly settings: InstanceSettingsService,
  ) {}

  @Get(':type')
  verify(@Param('type') type: string, @Query() query: Record<string, unknown>): string {
    const provider = this.providers.find(type);
    if (!provider) throw new NotFoundException();
    const challenge = provider.verifySubscription(query);
    if (challenge === null) throw new ForbiddenException();
    return challenge;
  }

  @Post(':type')
  @HttpCode(200)
  async receive(
    @Param('type') type: string,
    @Req() request: AppRequest,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ): Promise<{ received: true }> {
    const provider = this.providers.find(type);
    if (!provider) throw new NotFoundException();
    if (!request.rawBody || !provider.verifySignature(request.rawBody, headers)) {
      this.logger.warn({ type }, 'Rejected webhook with an invalid signature');
      throw new UnauthorizedException();
    }

    await this.ingestor.ingest(provider.type, request.body);
    return { received: true };
  }

  /** Meta calls this when someone removes the app from their account. */
  @Post('instagram/deauthorize')
  @HttpCode(200)
  async deauthorize(@Body() body: Record<string, unknown>): Promise<{ ok: true }> {
    const channel = await this.channelForSignedRequest(body.signed_request);
    if (channel) await this.channels.disconnect(channel.workspaceId, channel.id, null);
    return { ok: true };
  }

  /** Meta's data deletion callback: removes the account and everything learned through it. */
  @Post('instagram/data-deletion')
  @HttpCode(200)
  async dataDeletion(
    @Body() body: Record<string, unknown>,
  ): Promise<{ url: string; confirmation_code: string }> {
    const channel = await this.channelForSignedRequest(body.signed_request);
    if (channel) await this.prisma.channel.delete({ where: { id: channel.id } });
    const code = this.crypto.randomToken(12);
    return { url: this.config.url(`/legal/data-deletion?code=${code}`), confirmation_code: code };
  }

  private async channelForSignedRequest(signedRequest: unknown) {
    const app = this.settings.instagram;
    const data = app ? parseSignedRequest(signedRequest, app.appSecret) : null;
    if (!data) throw new UnauthorizedException();
    if (!data.user_id) return null;
    return this.prisma.channel.findUnique({
      where: { type_externalId: { type: 'INSTAGRAM', externalId: data.user_id } },
    });
  }
}
