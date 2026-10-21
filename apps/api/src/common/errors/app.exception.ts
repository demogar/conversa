import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@conversa/shared';

const STATUS: Partial<Record<ErrorCode, HttpStatus>> = {
  VALIDATION_FAILED: HttpStatus.BAD_REQUEST,
  UNAUTHENTICATED: HttpStatus.UNAUTHORIZED,
  INVALID_CREDENTIALS: HttpStatus.UNAUTHORIZED,
  MFA_INVALID: HttpStatus.UNAUTHORIZED,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  CSRF_REJECTED: HttpStatus.FORBIDDEN,
  CAPTCHA_FAILED: HttpStatus.FORBIDDEN,
  SIGNUP_CLOSED: HttpStatus.FORBIDDEN,
  INVITATION_EMAIL_MISMATCH: HttpStatus.FORBIDDEN,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  CONFLICT: HttpStatus.CONFLICT,
  EMAIL_TAKEN: HttpStatus.CONFLICT,
  ALREADY_MEMBER: HttpStatus.CONFLICT,
  LAST_OWNER: HttpStatus.CONFLICT,
  CHANNEL_IN_OTHER_WORKSPACE: HttpStatus.CONFLICT,
  ACCOUNT_LOCKED: HttpStatus.TOO_MANY_REQUESTS,
  RATE_LIMITED: HttpStatus.TOO_MANY_REQUESTS,
  BUFFER_RATE_LIMITED: HttpStatus.TOO_MANY_REQUESTS,
  TOKEN_INVALID: HttpStatus.BAD_REQUEST,
  BUFFER_INVALID_KEY: HttpStatus.BAD_REQUEST,
  MESSAGING_WINDOW_CLOSED: HttpStatus.UNPROCESSABLE_ENTITY,
  CHANNEL_NEEDS_REAUTH: HttpStatus.UNPROCESSABLE_ENTITY,
  BUFFER_NOT_CONNECTED: HttpStatus.UNPROCESSABLE_ENTITY,
  CHANNEL_NOT_CONFIGURED: HttpStatus.SERVICE_UNAVAILABLE,
  MAIL_NOT_CONFIGURED: HttpStatus.SERVICE_UNAVAILABLE,
  PROVIDER_ERROR: HttpStatus.BAD_GATEWAY,
};

/** An expected failure with a stable code the web app can translate. */
export class AppException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    readonly fields?: Record<string, string[]>,
    status?: HttpStatus,
  ) {
    super(code, status ?? STATUS[code] ?? HttpStatus.BAD_REQUEST);
  }

  static notFound(): AppException {
    return new AppException(ErrorCode.NOT_FOUND);
  }

  static forbidden(): AppException {
    return new AppException(ErrorCode.FORBIDDEN);
  }
}
