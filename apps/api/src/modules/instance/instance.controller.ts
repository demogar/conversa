import { Controller, Get } from '@nestjs/common';
import type { InstanceDto } from '@conversa/shared';
import { AppConfig } from '../../config/app-config.js';
import { Public } from '../../common/http/decorators.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';

/** What the sign-in screens need to know about this installation. */
@Controller('instance')
export class InstanceController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  @Public()
  @Get()
  async get(): Promise<InstanceDto> {
    const hasUsers = (await this.prisma.user.findFirst({ select: { id: true } })) !== null;
    return {
      needsSetup: !hasUsers,
      signupOpen: !hasUsers || this.config.env.SIGNUP_MODE === 'open',
      mailEnabled: this.config.mailEnabled,
      captchaSiteKey: this.config.captchaEnabled ? (this.config.env.TURNSTILE_SITE_KEY ?? null) : null,
      providers: { instagram: this.config.sandbox || this.config.instagram !== null },
      sandbox: this.config.sandbox,
    };
  }
}
