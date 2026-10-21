import { Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { AppConfig } from '../../config/app-config.js';
import { CryptoService } from '../../common/crypto/crypto.service.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { AuthContext } from '../../common/http/request.js';

const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;
/** Activity updates are written at most this often per session. */
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export interface ClientInfo {
  ip: string;
  userAgent: string | null;
}

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly config: AppConfig,
  ) {}

  /**
   * `__Host-` cookies must be Secure, host-only and on path "/", so the browser
   * refuses to let a subdomain or plain-HTTP page set or overwrite them.
   */
  get cookieName(): string {
    return this.config.secureCookies ? '__Host-conversa_session' : 'conversa_session';
  }

  async create(userId: string, client: ClientInfo): Promise<string> {
    const token = this.crypto.randomToken(32);
    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: this.crypto.hashToken(token),
        ip: client.ip,
        userAgent: client.userAgent,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });
    return token;
  }

  async resolve(token: string | undefined): Promise<AuthContext | null> {
    if (!token || token.length > 128) return null;
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: this.crypto.hashToken(token) },
      select: { id: true, userId: true, expiresAt: true, lastSeenAt: true },
    });
    if (!session) return null;
    const now = Date.now();
    if (session.expiresAt.getTime() <= now) {
      await this.prisma.session.deleteMany({ where: { id: session.id } });
      return null;
    }
    if (now - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
      // Sliding expiry: an active session stays signed in.
      await this.prisma.session.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date(now), expiresAt: new Date(now + SESSION_TTL_MS) },
      });
    }
    return { userId: session.userId, sessionId: session.id };
  }

  async revoke(userId: string, sessionId: string): Promise<boolean> {
    const { count } = await this.prisma.session.deleteMany({ where: { id: sessionId, userId } });
    return count > 0;
  }

  async revokeAll(userId: string, exceptSessionId?: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
    });
  }

  setCookie(response: Response, token: string): void {
    response.cookie(this.cookieName, token, {
      httpOnly: true,
      secure: this.config.secureCookies,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_MS,
    });
  }

  clearCookie(response: Response): void {
    response.clearCookie(this.cookieName, {
      httpOnly: true,
      secure: this.config.secureCookies,
      sameSite: 'lax',
      path: '/',
    });
  }
}
