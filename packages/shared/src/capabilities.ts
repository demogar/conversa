import type { ChannelType } from './enums.js';

/**
 * What each platform lets an automation do. The engine and the automation
 * editor read these instead of checking the platform by name.
 */
export interface ChannelCapabilities {
  /** Comments on the account's posts can start automations. */
  commentTriggers: boolean;
  /** Messages can carry link buttons; without them, links are written into the text. */
  linkButtons: boolean;
  /** The longest payload a tap button can carry back. */
  postbackPayloadLength: number;
  /**
   * How Conversa learns whether a person follows the account: by asking the
   * platform (`lookup`), or only from what their own messages say (`webhook`).
   */
  followStatus: 'lookup' | 'webhook';
}

export const CHANNEL_CAPABILITIES: Record<ChannelType, ChannelCapabilities> = {
  INSTAGRAM: {
    commentTriggers: true,
    linkButtons: true,
    postbackPayloadLength: 1000,
    followStatus: 'lookup',
  },
  // TikTok cannot message the author of a comment, has only reply buttons
  // (whose id holds 40 characters), and reports following only in DM webhooks.
  TIKTOK: {
    commentTriggers: false,
    linkButtons: false,
    postbackPayloadLength: 40,
    followStatus: 'webhook',
  },
};
