/**
 * Domain enums shared by the API and the web app. The values mirror the
 * Prisma enums one to one, so a value can cross the wire without mapping.
 */

export const ChannelType = { INSTAGRAM: 'INSTAGRAM' } as const;
export type ChannelType = (typeof ChannelType)[keyof typeof ChannelType];

export const ChannelStatus = {
  ACTIVE: 'ACTIVE',
  NEEDS_REAUTH: 'NEEDS_REAUTH',
  DISCONNECTED: 'DISCONNECTED',
} as const;
export type ChannelStatus = (typeof ChannelStatus)[keyof typeof ChannelStatus];

export const WorkspaceRole = { OWNER: 'OWNER', ADMIN: 'ADMIN', MEMBER: 'MEMBER' } as const;
export type WorkspaceRole = (typeof WorkspaceRole)[keyof typeof WorkspaceRole];

/** Higher rank means more privileges. */
export const ROLE_RANK: Record<WorkspaceRole, number> = { OWNER: 3, ADMIN: 2, MEMBER: 1 };

export function hasRole(actual: WorkspaceRole, required: WorkspaceRole): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

export const AutomationStatus = { DRAFT: 'DRAFT', ACTIVE: 'ACTIVE', PAUSED: 'PAUSED' } as const;
export type AutomationStatus = (typeof AutomationStatus)[keyof typeof AutomationStatus];

/** What starts an automation. */
export const TriggerType = {
  /** A comment on a post or reel. */
  COMMENT: 'COMMENT',
  /** An inbound direct message, including text replies to a story. */
  MESSAGE: 'MESSAGE',
} as const;
export type TriggerType = (typeof TriggerType)[keyof typeof TriggerType];

/** Which posts a comment trigger listens to. */
export const PostScope = {
  ANY: 'ANY',
  SPECIFIC: 'SPECIFIC',
  /** The next post published on the channel; resolved when it appears. */
  NEXT_POST: 'NEXT_POST',
  /** A post scheduled in Buffer; resolved once Buffer publishes it. */
  BUFFER_POST: 'BUFFER_POST',
} as const;
export type PostScope = (typeof PostScope)[keyof typeof PostScope];

export const MatchMode = {
  /** Fire when the text contains one of the keywords. */
  KEYWORDS: 'KEYWORDS',
  /** Fire on every comment or message. */
  ANYTHING: 'ANYTHING',
} as const;
export type MatchMode = (typeof MatchMode)[keyof typeof MatchMode];

export const DeliveryStatus = {
  PENDING: 'PENDING',
  AWAITING_TAP: 'AWAITING_TAP',
  AWAITING_FOLLOW: 'AWAITING_FOLLOW',
  SENT: 'SENT',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
} as const;
export type DeliveryStatus = (typeof DeliveryStatus)[keyof typeof DeliveryStatus];

export const SkipReason = {
  RATE_LIMITED: 'RATE_LIMITED',
  AUTOMATION_PAUSED: 'AUTOMATION_PAUSED',
  CHANNEL_INACTIVE: 'CHANNEL_INACTIVE',
} as const;
export type SkipReason = (typeof SkipReason)[keyof typeof SkipReason];

export const Locale = { EN: 'en', ES: 'es' } as const;
export type Locale = (typeof Locale)[keyof typeof Locale];
export const LOCALES: readonly Locale[] = [Locale.EN, Locale.ES];
export const DEFAULT_LOCALE: Locale = Locale.EN;

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}
