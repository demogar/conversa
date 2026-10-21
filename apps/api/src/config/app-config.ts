import type { Env } from './env.js';

/**
 * Typed, read-only view of the configuration. Injected wherever a setting is
 * needed, so nothing else reads process.env.
 */
export class AppConfig {
  constructor(readonly env: Env) {}

  get isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }

  get appUrl(): string {
    return this.env.APP_URL;
  }

  get appOrigin(): string {
    return new URL(this.env.APP_URL).origin;
  }

  /** Cookies are marked Secure whenever the public URL is HTTPS. */
  get secureCookies(): boolean {
    return this.env.APP_URL.startsWith('https://');
  }

  get mailEnabled(): boolean {
    return Boolean(this.env.SMTP_URL);
  }

  get captchaEnabled(): boolean {
    return Boolean(this.env.TURNSTILE_SITE_KEY && this.env.TURNSTILE_SECRET_KEY);
  }

  get instagram(): { appId: string; appSecret: string; verifyToken: string } | null {
    const { INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, INSTAGRAM_WEBHOOK_VERIFY_TOKEN } = this.env;
    if (!INSTAGRAM_APP_ID || !INSTAGRAM_APP_SECRET || !INSTAGRAM_WEBHOOK_VERIFY_TOKEN) return null;
    return {
      appId: INSTAGRAM_APP_ID,
      appSecret: INSTAGRAM_APP_SECRET,
      verifyToken: INSTAGRAM_WEBHOOK_VERIFY_TOKEN,
    };
  }

  url(path: string): string {
    return `${this.env.APP_URL}${path.startsWith('/') ? path : `/${path}`}`;
  }
}
