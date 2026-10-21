import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { type ApiErrorBody, ErrorCode } from '@conversa/shared';
import { AppException } from './app.exception.js';

const BY_STATUS: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.VALIDATION_FAILED,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.UNAUTHENTICATED,
  [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
  [HttpStatus.CONFLICT]: ErrorCode.CONFLICT,
  [HttpStatus.PAYLOAD_TOO_LARGE]: ErrorCode.VALIDATION_FAILED,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.RATE_LIMITED,
};

/**
 * Turns every error into `{ error: { code } }`. Unexpected errors are logged
 * with the request id and answered with a generic INTERNAL code, so no stack
 * trace or internal message ever reaches a client.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request & { id?: string }>();
    const requestId = typeof request.id === 'string' ? request.id : undefined;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: ApiErrorBody['error'] = { code: ErrorCode.INTERNAL, requestId };

    if (exception instanceof AppException) {
      status = exception.getStatus();
      body = { code: exception.code, fields: exception.fields, requestId };
    } else if (exception instanceof ThrottlerException) {
      status = HttpStatus.TOO_MANY_REQUESTS;
      body = { code: ErrorCode.RATE_LIMITED, requestId };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      body = { code: BY_STATUS[status] ?? ErrorCode.INTERNAL, requestId };
    }

    if (status >= 500) {
      this.logger.error({ err: exception, requestId }, 'Unhandled error');
    }

    if (!response.headersSent) {
      response.status(status).json({ error: body } satisfies ApiErrorBody);
    }
  }
}
