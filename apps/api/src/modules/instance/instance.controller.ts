import { Controller, Get } from '@nestjs/common';
import type { InstanceDto } from '@conversa/shared';
import { AppConfig } from '../../config/app-config.js';
import { BuildInfo } from '../../config/build-info.js';
import { Public } from '../../common/http/decorators.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { InstanceSettingsService } from './instance-settings.service.js';

/** What the sign-in screens need to know about this installation. Never a secret. */
@Controller('instance')
export class InstanceController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly settings: InstanceSettingsService,
    private readonly build: BuildInfo,
  ) {}

  @Public()
  @Get()
  async get(): Promise<InstanceDto> {
    const hasUsers = (await this.prisma.user.findFirst({ select: { id: true } })) !== null;
    return {
      needsSetup: !hasUsers,
      signupOpen: !hasUsers || this.settings.signupMode === 'open',
      mailEnabled: this.settings.mail !== null,
      captchaSiteKey: this.settings.turnstile?.siteKey ?? null,
      providers: {
        instagram: this.config.sandbox || this.settings.instagram !== null,
        tiktok: this.config.sandbox || this.settings.tiktok !== null,
      },
      sandbox: this.config.sandbox,
      version: this.build.version,
    };
  }
}
