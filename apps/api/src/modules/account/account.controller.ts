import { Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import QRCode from 'qrcode';
import {
  type ChangePasswordInput,
  changePasswordSchema,
  type DisableMfaInput,
  disableMfaSchema,
  type TotpCodeInput,
  totpCodeSchema,
  type UpdateProfileInput,
  updateProfileSchema,
} from '@conversa/shared';
import { ClientIp, CurrentAuth } from '../../common/http/decorators.js';
import type { AuthContext } from '../../common/http/request.js';
import { ZodBody } from '../../common/validation/zod.pipe.js';
import { AccountService } from './account.service.js';

const SENSITIVE = { default: { limit: 10, ttl: 60_000, blockDuration: 5 * 60_000 } };

@Controller('me')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get()
  me(@CurrentAuth() auth: AuthContext) {
    return this.account.me(auth.userId);
  }

  @Patch()
  update(@CurrentAuth() auth: AuthContext, @ZodBody(updateProfileSchema) body: UpdateProfileInput) {
    return this.account.updateProfile(auth.userId, body);
  }

  @Throttle(SENSITIVE)
  @Post('password')
  @HttpCode(204)
  async changePassword(
    @CurrentAuth() auth: AuthContext,
    @ZodBody(changePasswordSchema) body: ChangePasswordInput,
    @ClientIp() ip: string,
  ): Promise<void> {
    await this.account.changePassword(auth, body, ip);
  }

  @Get('sessions')
  sessions(@CurrentAuth() auth: AuthContext) {
    return this.account.listSessions(auth);
  }

  @Delete('sessions/:sessionId')
  @HttpCode(204)
  async revokeSession(
    @CurrentAuth() auth: AuthContext,
    @Param('sessionId') sessionId: string,
  ): Promise<void> {
    await this.account.revokeSession(auth, sessionId);
  }

  /** Returns the secret and a QR code (SVG) for authenticator apps. */
  @Post('mfa/setup')
  async startMfa(@CurrentAuth() auth: AuthContext) {
    const setup = await this.account.startMfaSetup(auth.userId);
    const qrSvg = await QRCode.toString(setup.otpauthUrl, { type: 'svg', margin: 1 });
    return { ...setup, qrSvg };
  }

  @Throttle(SENSITIVE)
  @Post('mfa/enable')
  enableMfa(
    @CurrentAuth() auth: AuthContext,
    @ZodBody(totpCodeSchema) body: TotpCodeInput,
    @ClientIp() ip: string,
  ) {
    return this.account.enableMfa(auth, body.code, ip);
  }

  @Throttle(SENSITIVE)
  @Post('mfa/disable')
  @HttpCode(204)
  async disableMfa(
    @CurrentAuth() auth: AuthContext,
    @ZodBody(disableMfaSchema) body: DisableMfaInput,
    @ClientIp() ip: string,
  ): Promise<void> {
    await this.account.disableMfa(auth.userId, body.password, ip);
  }
}
