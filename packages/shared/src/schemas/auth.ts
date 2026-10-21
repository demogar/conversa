import { z } from 'zod';
import { LIMITS } from '../limits.js';
import { LOCALES } from '../enums.js';
import { email } from './common.js';

export const password = z
  .string()
  .min(LIMITS.passwordMinLength, 'password_too_short')
  .max(LIMITS.passwordMaxLength, 'password_too_long');

export const displayName = z.string().trim().min(1).max(80);

const captcha = z.string().max(4096).optional();

export const signupSchema = z.object({
  name: displayName,
  email,
  password,
  locale: z.enum(LOCALES as [string, ...string[]]).optional(),
  invitationToken: z.string().max(128).optional(),
  captchaToken: captcha,
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(LIMITS.passwordMaxLength),
  captchaToken: captcha,
});
export type LoginInput = z.infer<typeof loginSchema>;

export const mfaVerifySchema = z.object({
  challenge: z.string().min(1).max(512),
  /** A six-digit authenticator code or a recovery code. */
  code: z.string().trim().min(6).max(32),
});
export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;

export const forgotPasswordSchema = z.object({ email, captchaToken: captcha });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(16).max(128),
  password,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(LIMITS.passwordMaxLength),
  newPassword: password,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const updateProfileSchema = z.object({
  name: displayName.optional(),
  locale: z.enum(LOCALES as [string, ...string[]]).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const totpCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'invalid_code'),
});
export type TotpCodeInput = z.infer<typeof totpCodeSchema>;

export const disableMfaSchema = z.object({
  password: z.string().min(1).max(LIMITS.passwordMaxLength),
});
export type DisableMfaInput = z.infer<typeof disableMfaSchema>;
