import { Body, type PipeTransform, Query } from '@nestjs/common';
import type { z } from 'zod';
import { ErrorCode, issuesToFields } from '@conversa/shared';
import { AppException } from '../errors/app.exception.js';

export class ZodPipe<T extends z.ZodType> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, issuesToFields(result.error));
    }
    return result.data;
  }
}

/** `@ZodBody(schema)`: the request body, parsed and typed by the schema. */
export const ZodBody = (schema: z.ZodType): ParameterDecorator => Body(new ZodPipe(schema));

export const ZodQuery = (schema: z.ZodType): ParameterDecorator => Query(new ZodPipe(schema));
