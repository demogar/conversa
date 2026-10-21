import { z } from 'zod';
import { LIMITS } from '../limits.js';
import { AutomationStatus, MatchMode, PostScope, TriggerType } from '../enums.js';
import { httpUrl, id } from './common.js';

const buttonLabel = z.string().trim().min(1).max(LIMITS.buttonLabelLength);

export const linkButtonSchema = z.object({
  label: buttonLabel,
  url: httpUrl,
});
export type LinkButton = z.infer<typeof linkButtonSchema>;

/** A message with a single button the contact taps to continue the flow. */
const gateSchema = z.object({
  enabled: z.boolean().default(false),
  text: z.string().trim().max(LIMITS.dmTextLength).default(''),
  buttonLabel: z.string().trim().max(LIMITS.buttonLabelLength).default(''),
});

/**
 * What an automation sends once it fires. Messages may use the `{username}`
 * placeholder, replaced with the contact's handle at send time.
 */
export const automationResponseSchema = z
  .object({
    /** Public replies under the comment; one variant is picked at random. */
    publicReply: z
      .object({
        enabled: z.boolean().default(false),
        variants: z
          .array(z.string().trim().min(1).max(LIMITS.publicReplyLength))
          .max(LIMITS.publicReplyVariants)
          .default([]),
      })
      .default({ enabled: false, variants: [] }),
    /** The direct message carrying the content. Links become tracked buttons. */
    message: z.object({
      text: z.string().trim().min(1, 'message_required').max(LIMITS.dmTextLength),
      buttons: z.array(linkButtonSchema).max(LIMITS.dmButtons).default([]),
    }),
    /** An opening message whose button the contact taps before the content. */
    opening: gateSchema.default({ enabled: false, text: '', buttonLabel: '' }),
    /** Ask the contact to follow the account before sending the content. */
    followGate: gateSchema.default({ enabled: false, text: '', buttonLabel: '' }),
  })
  .superRefine((value, ctx) => {
    for (const key of ['opening', 'followGate'] as const) {
      const gate = value[key];
      if (!gate.enabled) continue;
      if (!gate.text) ctx.addIssue({ code: 'custom', path: [key, 'text'], message: 'required' });
      if (!gate.buttonLabel) {
        ctx.addIssue({ code: 'custom', path: [key, 'buttonLabel'], message: 'required' });
      }
    }
    if (value.publicReply.enabled && value.publicReply.variants.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['publicReply', 'variants'], message: 'required' });
    }
  });
export type AutomationResponse = z.infer<typeof automationResponseSchema>;

const automationBase = z.object({
  name: z.string().trim().min(1).max(LIMITS.automationNameLength),
  channelId: id,
  triggerType: z.enum([TriggerType.COMMENT, TriggerType.MESSAGE]),
  postScope: z
    .enum([PostScope.ANY, PostScope.SPECIFIC, PostScope.NEXT_POST, PostScope.BUFFER_POST])
    .default(PostScope.ANY),
  mediaIds: z.array(z.string().trim().min(1).max(64)).max(LIMITS.mediaIdsPerAutomation).default([]),
  bufferPostId: z.string().trim().max(64).nullish(),
  matchMode: z.enum([MatchMode.KEYWORDS, MatchMode.ANYTHING]).default(MatchMode.KEYWORDS),
  keywords: z
    .array(z.string().trim().min(1).max(LIMITS.keywordLength))
    .max(LIMITS.keywordsPerAutomation)
    .default([]),
  wholeWord: z.boolean().default(true),
  /** Respond to each contact at most once per automation. */
  oncePerContact: z.boolean().default(true),
  response: automationResponseSchema,
});

type AutomationShape = z.infer<typeof automationBase>;

function refineAutomation(value: AutomationShape, ctx: z.RefinementCtx): void {
  if (value.matchMode === MatchMode.KEYWORDS && value.keywords.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['keywords'], message: 'keywords_required' });
  }
  if (value.triggerType === TriggerType.COMMENT) {
    if (value.postScope === PostScope.SPECIFIC && value.mediaIds.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['mediaIds'], message: 'posts_required' });
    }
    if (value.postScope === PostScope.BUFFER_POST && !value.bufferPostId) {
      ctx.addIssue({ code: 'custom', path: ['bufferPostId'], message: 'buffer_post_required' });
    }
  } else if (value.response.publicReply.enabled) {
    ctx.addIssue({
      code: 'custom',
      path: ['response', 'publicReply', 'enabled'],
      message: 'public_reply_comment_only',
    });
  }
}

export const createAutomationSchema = automationBase
  .extend({ status: z.enum([AutomationStatus.DRAFT, AutomationStatus.ACTIVE]).default('DRAFT') })
  .superRefine(refineAutomation);
export type CreateAutomationInput = z.infer<typeof createAutomationSchema>;

export const updateAutomationSchema = automationBase.superRefine(refineAutomation);
export type UpdateAutomationInput = z.infer<typeof updateAutomationSchema>;

export const setAutomationStatusSchema = z.object({
  status: z.enum([AutomationStatus.ACTIVE, AutomationStatus.PAUSED]),
});
export type SetAutomationStatusInput = z.infer<typeof setAutomationStatusSchema>;

