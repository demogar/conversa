import type { Env } from './env.js';

/**
 * Typed, read-only view of the configuration. Injected wherever a setting is
 * needed, so nothing else reads process.env. Only what the process needs to
 * start lives here; mail, the Meta app, Turnstile and the sign-up mode are
 * edited in the admin area (InstanceSettingsService).
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

  /** Instagram is simulated: no Meta app, nothing leaves the instance. */
  get sandbox(): boolean {
    return this.env.INSTAGRAM_SANDBOX;
  }

  url(path: string): string {
    return `${this.env.APP_URL}${path.startsWith('/') ? path : `/${path}`}`;
  }
}
