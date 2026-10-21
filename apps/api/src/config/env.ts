import { z } from 'zod';

const booleanish = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((value) => value === 'true' || value === '1');

const optionalString = z
  .string()
  .optional()
  .transform((value) => (value && value.trim() ? value.trim() : undefined));

const trustProxy = z
  .string()
  .default('none')
  .transform((value, ctx) => {
    if (value === 'none' || value === 'cloudflare') return value;
    const hops = Number(value);
    if (Number.isInteger(hops) && hops >= 0 && hops <= 10) return hops;
    ctx.addIssue({ code: 'custom', message: 'must be none, cloudflare or a hop count (0-10)' });
    return z.NEVER;
  });

const base64Key = z.string().refine((value) => Buffer.from(value, 'base64').length === 32, {
  message: 'must be 32 bytes encoded as base64 (run pnpm secrets:generate)',
});

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  APP_URL: z.url().transform((value) => value.replace(/\/+$/, '')),
  API_PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  REDIS_URL: z.string().min(1),
  SECRET_KEY: z.string().min(32, 'must be at least 32 characters (run pnpm secrets:generate)'),
  ENCRYPTION_KEY: base64Key,
  ENCRYPTION_KEYS_PREVIOUS: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(',')
            .map((key) => key.trim())
            .filter(Boolean)
        : [],
    )
    .pipe(z.array(base64Key)),
  SIGNUP_MODE: z.enum(['invite_only', 'open']).default('invite_only'),
  TRUST_PROXY: trustProxy,
  SMTP_URL: optionalString,
  MAIL_FROM: z.string().default('Conversa <no-reply@localhost>'),
  TURNSTILE_SITE_KEY: optionalString,
  TURNSTILE_SECRET_KEY: optionalString,
  INSTAGRAM_APP_ID: optionalString,
  INSTAGRAM_APP_SECRET: optionalString,
  INSTAGRAM_WEBHOOK_VERIFY_TOKEN: optionalString,
  META_GRAPH_VERSION: z
    .string()
    .regex(/^v\d+\.\d+$/)
    .default('v24.0'),
  /** Run the worker's processors inside the API process (small installs). */
  WORKER_IN_API: booleanish,
  /** A simulated Instagram for trying Conversa and for end-to-end tests. Never in production. */
  INSTAGRAM_SANDBOX: booleanish,
});

export type Env = z.infer<typeof envSchema>;

/** Parses the environment, failing fast with every problem listed at once. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid configuration:\n${problems}`);
  }
  if (result.data.INSTAGRAM_SANDBOX && result.data.NODE_ENV === 'production') {
    throw new Error(
      'Invalid configuration:\n  - INSTAGRAM_SANDBOX: the simulated Instagram cannot run with NODE_ENV=production',
    );
  }
  return result.data;
}
