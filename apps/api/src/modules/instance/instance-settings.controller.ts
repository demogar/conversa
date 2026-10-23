import { Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ErrorCode,
  INSTANCE_SETTINGS_SECTIONS,
  type InstanceSettingsDto,
  type InstanceSettingsSection,
  type InstanceUserDto,
  isLocale,
  type MailTestResultDto,
  type SendTestMailInput,
  sendTestMailSchema,
  type UpdateInstagramSettingsInput,
  updateInstagramSettingsSchema,
  type UpdateInstanceAdminInput,
  updateInstanceAdminSchema,
  type UpdateMailSettingsInput,
  updateMailSettingsSchema,
  type UpdateSignupSettingsInput,
  updateSignupSettingsSchema,
  type UpdateTikTokSettingsInput,
  updateTikTokSettingsSchema,
  type UpdateTurnstileSettingsInput,
  updateTurnstileSettingsSchema,
} from '@conversa/shared';
import { AppConfig } from '../../config/app-config.js';
import { AppException } from '../../common/errors/app.exception.js';
import { ClientIp, CurrentAuth, RequireInstanceAdmin } from '../../common/http/decorators.js';
import type { AuthContext } from '../../common/http/request.js';
import { ZodBody } from '../../common/validation/zod.pipe.js';
import { MailService } from '../../infra/mail/mail.service.js';
import { testMail } from '../../infra/mail/templates.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { InstanceAdminsService } from './instance-admins.service.js';
import { InstanceSettingsService } from './instance-settings.service.js';

/** The admin area: installation-wide settings and who may change them. */
@RequireInstanceAdmin()
@Controller('instance')
export class InstanceSettingsController {
  constructor(
    private readonly settings: InstanceSettingsService,
    private readonly admins: InstanceAdminsService,
    private readonly mail: MailService,
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  @Get('settings')
  get(): InstanceSettingsDto {
    return this.settings.toDto();
  }

  @Patch('settings/mail')
  async updateMail(
    @CurrentAuth() auth: AuthContext,
    @ZodBody(updateMailSettingsSchema) body: UpdateMailSettingsInput,
    @ClientIp() ip: string,
  ): Promise<InstanceSettingsDto> {
    await this.settings.update('mail', body, auth.userId, ip);
    return this.settings.toDto();
  }

  @Patch('settings/instagram')
  async updateInstagram(
    @CurrentAuth() auth: AuthContext,
    @ZodBody(updateInstagramSettingsSchema) body: UpdateInstagramSettingsInput,
    @ClientIp() ip: string,
  ): Promise<InstanceSettingsDto> {
    await this.settings.update('instagram', body, auth.userId, ip);
    return this.settings.toDto();
  }

  @Patch('settings/tiktok')
  async updateTikTok(
    @CurrentAuth() auth: AuthContext,
    @ZodBody(updateTikTokSettingsSchema) body: UpdateTikTokSettingsInput,
    @ClientIp() ip: string,
  ): Promise<InstanceSettingsDto> {
    await this.settings.update('tiktok', body, auth.userId, ip);
    return this.settings.toDto();
  }

  @Patch('settings/turnstile')
  async updateTurnstile(
    @CurrentAuth() auth: AuthContext,
    @ZodBody(updateTurnstileSettingsSchema) body: UpdateTurnstileSettingsInput,
    @ClientIp() ip: string,
  ): Promise<InstanceSettingsDto> {
    await this.settings.update('turnstile', body, auth.userId, ip);
    return this.settings.toDto();
  }

  @Patch('settings/signup')
  async updateSignup(
    @CurrentAuth() auth: AuthContext,
    @ZodBody(updateSignupSettingsSchema) body: UpdateSignupSettingsInput,
    @ClientIp() ip: string,
  ): Promise<InstanceSettingsDto> {
    await this.settings.update('signup', body, auth.userId, ip);
    return this.settings.toDto();
  }

  /** Forgets a section, which turns that feature off. */
  @Delete('settings/:section')
  async clear(
    @CurrentAuth() auth: AuthContext,
    @Param('section') section: string,
    @ClientIp() ip: string,
  ): Promise<InstanceSettingsDto> {
    if (!(INSTANCE_SETTINGS_SECTIONS as readonly string[]).includes(section)) {
      throw AppException.notFound();
    }
    await this.settings.clear(section as InstanceSettingsSection, auth.userId, ip);
    return this.settings.toDto();
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('settings/mail/test')
  @HttpCode(200)
  async testMail(
    @CurrentAuth() auth: AuthContext,
    @ZodBody(sendTestMailSchema) body: SendTestMailInput,
  ): Promise<MailTestResultDto> {
    if (!this.mail.enabled) throw new AppException(ErrorCode.MAIL_NOT_CONFIGURED);
    const user = await this.prisma.user.findUnique({
      where: { id: auth.userId },
      select: { locale: true },
    });
    const locale = user && isLocale(user.locale) ? user.locale : 'en';
    const failure = await this.mail.test(
      body.to,
      testMail(locale, { url: this.config.url('/admin') }),
    );
    return { ok: failure === null, failure };
  }

  @Get('admins')
  listAdmins(): Promise<InstanceUserDto[]> {
    return this.admins.list();
  }

  @Patch('admins/:userId')
  updateAdmin(
    @CurrentAuth() auth: AuthContext,
    @Param('userId') userId: string,
    @ZodBody(updateInstanceAdminSchema) body: UpdateInstanceAdminInput,
    @ClientIp() ip: string,
  ): Promise<InstanceUserDto> {
    return this.admins.setAdmin(userId, body.isInstanceAdmin, auth.userId, ip);
  }
}
