import { z } from 'zod';

/** Accepts only absolute http(s) URLs, so a stored link can never run script. */
export const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
      return false;
    }
  }, 'invalid_url');

export const email = z.string().trim().toLowerCase().max(254).pipe(z.email());

export const id = z.string().trim().min(1).max(64);

export const paginationQuery = z.object({
  cursor: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type PaginationQuery = z.infer<typeof paginationQuery>;

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
