/** Query keys, in one place so invalidation matches what was cached. */
export const keys = {
  instance: ['instance'] as const,
  me: ['me'] as const,
  sessions: ['me', 'sessions'] as const,
  invitation: (token: string) => ['invitation', token] as const,
  workspace: (workspaceId: string) => ['workspace', workspaceId] as const,
  members: (workspaceId: string) => ['workspace', workspaceId, 'members'] as const,
  invitations: (workspaceId: string) => ['workspace', workspaceId, 'invitations'] as const,
  audit: (workspaceId: string) => ['workspace', workspaceId, 'audit'] as const,
  channels: (workspaceId: string) => ['workspace', workspaceId, 'channels'] as const,
  media: (workspaceId: string, channelId: string) => ['workspace', workspaceId, 'channels', channelId, 'media'] as const,
  conversations: (workspaceId: string, channelId: string) =>
    ['workspace', workspaceId, 'channels', channelId, 'conversations'] as const,
  messages: (workspaceId: string, channelId: string, conversationId: string) =>
    ['workspace', workspaceId, 'channels', channelId, 'conversations', conversationId] as const,
  automations: (workspaceId: string) => ['workspace', workspaceId, 'automations'] as const,
  automation: (workspaceId: string, automationId: string) =>
    ['workspace', workspaceId, 'automations', automationId] as const,
  contacts: (workspaceId: string, filters: object = {}) => ['workspace', workspaceId, 'contacts', filters] as const,
  activity: (workspaceId: string, filters: object = {}) => ['workspace', workspaceId, 'activity', filters] as const,
  dashboard: (workspaceId: string, days: number) => ['workspace', workspaceId, 'dashboard', days] as const,
  buffer: (workspaceId: string) => ['workspace', workspaceId, 'buffer'] as const,
  bufferOrganizations: (workspaceId: string) => ['workspace', workspaceId, 'buffer', 'organizations'] as const,
  bufferChannels: (workspaceId: string) => ['workspace', workspaceId, 'buffer', 'channels'] as const,
  bufferPosts: (workspaceId: string, view: string) => ['workspace', workspaceId, 'buffer', 'posts', view] as const,
};
