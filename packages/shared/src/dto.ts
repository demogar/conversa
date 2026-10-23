/**
 * Response shapes returned by the API. Dates travel as ISO 8601 strings.
 */
import type {
  AutomationStatus,
  ChannelStatus,
  ChannelType,
  DeliveryStatus,
  Locale,
  MatchMode,
  PostScope,
  TriggerType,
  WorkspaceRole,
} from './enums.js';
import type { AutomationResponse } from './schemas/automation.js';
import type { MailSecurity, SignupMode } from './schemas/instance.js';

export interface UserDto {
  id: string;
  email: string;
  name: string;
  locale: Locale;
  mfaEnabled: boolean;
  /** Manages the installation: mail, the Meta app, captcha, sign-up. */
  isInstanceAdmin: boolean;
  createdAt: string;
}

export interface WorkspaceDto {
  id: string;
  name: string;
  role: WorkspaceRole;
  createdAt: string;
}

export interface MeDto {
  user: UserDto;
  workspaces: WorkspaceDto[];
}

export type LoginResultDto =
  { status: 'authenticated'; user: UserDto } | { status: 'mfa_required'; challenge: string };

export interface InstanceDto {
  /** True until the first account has been created on this instance. */
  needsSetup: boolean;
  signupOpen: boolean;
  mailEnabled: boolean;
  captchaSiteKey: string | null;
  providers: { instagram: boolean; tiktok: boolean };
  /** A simulated Instagram for trying Conversa without a Meta app. Never on in production. */
  sandbox: boolean;
  /** The API's version, from its package.json: "0.1.0". */
  version: string;
}

export interface SessionDto {
  id: string;
  current: boolean;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastSeenAt: string;
}

export interface MfaSetupDto {
  secret: string;
  otpauthUrl: string;
  /** The otpauth URL as a QR code, an SVG document rendered by the server. */
  qrSvg: string;
}

export interface RecoveryCodesDto {
  recoveryCodes: string[];
}

export interface MemberDto {
  userId: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  joinedAt: string;
}

export interface InvitationDto {
  id: string;
  email: string;
  role: WorkspaceRole;
  expiresAt: string;
  createdAt: string;
  invitedBy: string | null;
}

export interface CreatedInvitationDto extends InvitationDto {
  /** Shown once, so it can be shared when email delivery is not configured. */
  acceptUrl: string;
  emailed: boolean;
}

export interface InvitationPreviewDto {
  workspaceName: string;
  email: string;
  role: WorkspaceRole;
  expiresAt: string;
}

export interface ChannelDto {
  id: string;
  type: ChannelType;
  externalId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: ChannelStatus;
  webhookSubscribed: boolean;
  tokenExpiresAt: string | null;
  connectedAt: string;
  /** When a webhook for this account last arrived, to the minute. Null until the first one. */
  lastEventAt: string | null;
}

export interface MediaDto {
  id: string;
  caption: string | null;
  mediaType: string;
  thumbnailUrl: string | null;
  permalink: string | null;
  publishedAt: string;
  commentsCount: number | null;
}

export interface AutomationStatsDto {
  triggered: number;
  sent: number;
  failed: number;
  clicks: number;
}

export interface AutomationDto {
  id: string;
  name: string;
  status: AutomationStatus;
  channelId: string;
  triggerType: TriggerType;
  postScope: PostScope;
  mediaIds: string[];
  bufferPostId: string | null;
  matchMode: MatchMode;
  keywords: string[];
  wholeWord: boolean;
  oncePerContact: boolean;
  response: AutomationResponse;
  stats: AutomationStatsDto;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryDto {
  id: string;
  automationId: string;
  automationName: string;
  channelId: string;
  contact: { id: string; username: string | null };
  triggerText: string;
  matchedKeyword: string | null;
  status: DeliveryStatus;
  skipReason: string | null;
  errorCode: string | null;
  publicReplySent: boolean;
  attempts: number;
  createdAt: string;
  sentAt: string | null;
}

export interface ContactDto {
  id: string;
  channelId: string;
  externalId: string;
  username: string | null;
  interactions: number;
  isFollower: boolean | null;
  firstSeenAt: string;
  lastInteractionAt: string;
}

export interface ConversationDto {
  id: string;
  participant: { id: string; username: string | null };
  lastMessage: string | null;
  updatedAt: string | null;
}

export interface MessageDto {
  id: string;
  text: string | null;
  fromSelf: boolean;
  createdAt: string | null;
}

export interface DashboardDto {
  range: { from: string; to: string };
  totals: { triggered: number; sent: number; failed: number; clicks: number; contacts: number };
  activeAutomations: number;
  channels: number;
  daily: Array<{ date: string; sent: number; failed: number; clicks: number }>;
  topAutomations: Array<{ id: string; name: string; sent: number; clicks: number }>;
}

export interface BufferStatusDto {
  connected: boolean;
  organizationId: string | null;
  organizationName: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export interface BufferOrganizationDto {
  id: string;
  name: string;
}

export interface BufferChannelDto {
  id: string;
  name: string;
  service: string;
  avatar: string | null;
  /** The Conversa channel with the same Instagram handle, if any. */
  linkedChannelId: string | null;
}

export interface BufferPostDto {
  id: string;
  channelId: string;
  text: string;
  status: string;
  dueAt: string | null;
  sentAt: string | null;
  externalLink: string | null;
  thumbnailUrl: string | null;
  /** Automations already waiting for this post. */
  automationIds: string[];
}

export interface AuditEntryDto {
  id: string;
  action: string;
  actor: { id: string; name: string } | null;
  targetType: string | null;
  targetId: string | null;
  createdAt: string;
}

/** A stored secret as the admin area sees it: never the value itself. */
export interface SecretStatusDto {
  configured: boolean;
  /** The last four characters, for telling two values apart. Null for short secrets. */
  hint: string | null;
}

export interface MailSettingsDto {
  /** Host and sender are set, so Conversa sends email. */
  configured: boolean;
  host: string | null;
  port: number | null;
  security: MailSecurity;
  username: string | null;
  password: SecretStatusDto;
  fromName: string;
  fromAddress: string | null;
}

/** The addresses to paste into the Meta app dashboard, built from APP_URL. */
export interface MetaAppUrlsDto {
  oauthRedirect: string;
  webhook: string;
  deauthorize: string;
  dataDeletion: string;
  privacyPolicy: string;
  termsOfService: string;
}

export interface InstagramAppSettingsDto {
  /** App ID, app secret and verify token are all set. */
  configured: boolean;
  appId: string | null;
  appSecret: SecretStatusDto;
  verifyToken: SecretStatusDto;
  urls: MetaAppUrlsDto;
}

/** The addresses to paste into the TikTok developer app, built from APP_URL. */
export interface TikTokAppUrlsDto {
  /** Ends in a slash, as TikTok requires of redirect URLs. */
  oauthRedirect: string;
  webhook: string;
}

export interface TikTokAppSettingsDto {
  /** App ID, secret and authorization URL are all set. */
  configured: boolean;
  appId: string | null;
  appSecret: SecretStatusDto;
  authorizationUrl: string | null;
  urls: TikTokAppUrlsDto;
}

export interface TurnstileSettingsDto {
  configured: boolean;
  siteKey: string | null;
  secretKey: SecretStatusDto;
}

export interface InstanceSettingsDto {
  mail: MailSettingsDto;
  instagram: InstagramAppSettingsDto;
  tiktok: TikTokAppSettingsDto;
  turnstile: TurnstileSettingsDto;
  signup: { mode: SignupMode };
  /** The platforms are simulated (INSTAGRAM_SANDBOX): no Meta or TikTok app is used. */
  sandbox: boolean;
}

/**
 * What Meta said about the stored Instagram app ID and secret. `unknown` means
 * Meta could not be asked or answered in a way Conversa does not recognise.
 */
export type AppCredentialsCheck = 'valid' | 'invalid' | 'unknown' | 'not_configured';

/** How far a platform app's setup (Meta, TikTok) has got, as far as this installation can tell. */
export interface PlatformSetupStatusDto {
  /** The platform is simulated: its app is not used, so nothing is checked. */
  sandbox: boolean;
  credentials: AppCredentialsCheck;
  /** The platform's subscription handshake last reached this installation (Meta only). */
  webhookVerifiedAt: string | null;
  /** A signed webhook last arrived, for any account. */
  lastEventAt: string | null;
}
export type InstagramSetupStatusDto = PlatformSetupStatusDto;

export type MailTestFailure = 'auth' | 'connection' | 'timeout' | 'tls' | 'rejected' | 'unknown';

export interface MailTestResultDto {
  ok: boolean;
  /** Why the server refused, as a category. Never the server's own message. */
  failure: MailTestFailure | null;
}

export interface InstanceUserDto {
  id: string;
  name: string;
  email: string;
  isInstanceAdmin: boolean;
  createdAt: string;
}
