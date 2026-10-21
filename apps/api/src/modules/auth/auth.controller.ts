import { Controller, HttpCode, Post, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import {
  type ForgotPasswordInput,
  forgotPasswordSchema,
  type LoginInput,
  type LoginResultDto,
  loginSchema,
  type MfaVerifyInput,
  mfaVerifySchema,
  type ResetPasswordInput,
  resetPasswordSchema,
  type SignupInput,
  signupSchema,
  type UserDto,
} from '@conversa/shared';
import { ClientIp, CurrentAuth, Public, UserAgent } from '../../common/http/decorators.js';
import type { AuthContext } from '../../common/http/request.js';
import { ZodBody } from '../../common/validation/zod.pipe.js';
import { AuthService } from './auth.service.js';
import { SessionService } from './session.service.js';

/** Tight limits on the endpoints that guess passwords or send mail. */
const STRICT = { default: { limit: 10, ttl: 60_000, blockDuration: 5 * 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  @Public()
  @Throttle(STRICT)
  @Post('signup')
  async signup(
    @ZodBody(signupSchema) body: SignupInput,
    @ClientIp() ip: string,
    @UserAgent() userAgent: string | null,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserDto> {
    const { user, token } = await this.auth.signup(body, { ip, userAgent });
    this.sessions.setCookie(response, token);
    return user;
  }

  @Public()
  @Throttle(STRICT)
  @Post('login')
  @HttpCode(200)
  async login(
    @ZodBody(loginSchema) body: LoginInput,
    @ClientIp() ip: string,
    @UserAgent() userAgent: string | null,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResultDto> {
    const result = await this.auth.login(body, { ip, userAgent });
    if ('token' in result) {
      this.sessions.setCookie(response, result.token);
      return { status: 'authenticated', user: result.user };
    }
    return result;
  }

  @Public()
  @Throttle(STRICT)
  @Post('mfa')
  @HttpCode(200)
  async mfa(
    @ZodBody(mfaVerifySchema) body: MfaVerifyInput,
    @ClientIp() ip: string,
    @UserAgent() userAgent: string | null,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResultDto> {
    const { user, token } = await this.auth.verifyMfa(body, { ip, userAgent });
    this.sessions.setCookie(response, token);
    return { status: 'authenticated', user };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @CurrentAuth() auth: AuthContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(auth.sessionId, auth.userId);
    this.sessions.clearCookie(response);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @Post('password/forgot')
  @HttpCode(202)
  async forgot(
    @ZodBody(forgotPasswordSchema) body: ForgotPasswordInput,
    @ClientIp() ip: string,
  ): Promise<void> {
    await this.auth.forgotPassword(body, ip);
  }

  @Public()
  @Throttle(STRICT)
  @Post('password/reset')
  @HttpCode(204)
  async reset(
    @ZodBody(resetPasswordSchema) body: ResetPasswordInput,
    @ClientIp() ip: string,
  ): Promise<void> {
    await this.auth.resetPassword(body, ip);
  }
}
