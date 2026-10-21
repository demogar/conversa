import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { AppRequest } from '../http/request.js';

/** Rate limits by the resolved client IP rather than the proxy's address. */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(request: Record<string, unknown>): Promise<string> {
    return (request as unknown as AppRequest).clientIp ?? 'unknown';
  }
}
