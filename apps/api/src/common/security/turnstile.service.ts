import { Injectable, Logger } from '@nestjs/common';
import { ErrorCode } from '@conversa/shared';
import { AppConfig } from '../../config/app-config.js';
import { AppException } from '../errors/app.exception.js';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Verifies Cloudflare Turnstile tokens when Turnstile is configured. */
@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);

  constructor(private readonly config: AppConfig) {}

  async assertHuman(token: string | undefined, ip: string): Promise<void> {
    if (!this.config.captchaEnabled) return;
    if (!token) throw new AppException(ErrorCode.CAPTCHA_FAILED);
    try {
      const response = await fetch(VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: this.config.env.TURNSTILE_SECRET_KEY ?? '',
          response: token,
          remoteip: ip,
        }),
        signal: AbortSignal.timeout(5_000),
      });
      const result = (await response.json()) as { success?: boolean };
      if (result.success === true) return;
    } catch (error) {
      this.logger.warn({ err: error }, 'Turnstile verification unavailable');
    }
    throw new AppException(ErrorCode.CAPTCHA_FAILED);
  }
}
