import { z } from 'zod';
import { email } from './common.js';

/** How the connection to the mail server is protected. */
export const MAIL_SECURITY = ['tls', 'starttls', 'none'] as const;
export type MailSecurity = (typeof MAIL_SECURITY)[number];

export const SIGNUP_MODES = ['invite_only', 'open'] as const;
export type SignupMode = (typeof SIGNUP_MODES)[number];

/** Section names of `PATCH /instance/settings/:section`. */
export const INSTANCE_SETTINGS_SECTIONS = ['mail', 'instagram', 'turnstile', 'signup'] as const;
export type InstanceSettingsSection = (typeof INSTANCE_SETTINGS_SECTIONS)[number];

const noLineBreaks = /^[^\r\n]*$/;

/**
 * A stored secret in an update: left out or empty keeps the stored value, so a
 * form never has to show it again; `null` clears it.
 */
function secret(max: number, pattern = /^\S+$/) {
  return z
    .union([
      z.string().trim().max(max).regex(pattern, 'invalid_format').or(z.literal('')),
      z.null(),
    ])
    .optional()
    .transform((value) => (value === '' ? undefined : value));
}

export const updateMailSettingsSchema = z.object({
  host: z
    .string()
    .trim()
    .min(1)
    .max(253)
    .regex(/^[\w.-]+$|^\[[\da-f:.]+\]$/i, 'invalid_host'),
  port: z.coerce.number().int().min(1).max(65535),
  security: z.enum(MAIL_SECURITY),
  /** Empty: the server accepts mail without signing in. */
  username: z.string().trim().max(254).regex(noLineBreaks, 'invalid_format').default(''),
  password: secret(512, /^.*$/),
  fromName: z.string().trim().max(100).regex(noLineBreaks, 'invalid_format').default(''),
  fromAddress: email,
});
export type UpdateMailSettingsInput = z.infer<typeof updateMailSettingsSchema>;

export const updateInstagramSettingsSchema = z.object({
  appId: z
    .string()
    .trim()
    .regex(/^\d{5,32}$/, 'invalid_app_id'),
  appSecret: secret(128, /^[\w-]+$/),
  verifyToken: secret(128, /^[\w.~-]{8,}$/),
});
export type UpdateInstagramSettingsInput = z.infer<typeof updateInstagramSettingsSchema>;

export const updateTurnstileSettingsSchema = z.object({
  siteKey: z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[\w-]+$/, 'invalid_format'),
  secretKey: secret(256, /^[\w.-]+$/),
});
export type UpdateTurnstileSettingsInput = z.infer<typeof updateTurnstileSettingsSchema>;

export const updateSignupSettingsSchema = z.object({ mode: z.enum(SIGNUP_MODES) });
export type UpdateSignupSettingsInput = z.infer<typeof updateSignupSettingsSchema>;

export const sendTestMailSchema = z.object({ to: email });
export type SendTestMailInput = z.infer<typeof sendTestMailSchema>;

export const updateInstanceAdminSchema = z.object({ isInstanceAdmin: z.boolean() });
export type UpdateInstanceAdminInput = z.infer<typeof updateInstanceAdminSchema>;
