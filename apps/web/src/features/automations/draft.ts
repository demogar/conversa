import type { AutomationDto, UpdateAutomationInput } from '@conversa/shared';

/**
 * What the builder edits: the request body in the shape the schema parses,
 * so a field error's dotted path (`response.message.text`) names the same
 * place in the form and in the state.
 */
export type AutomationDraft = UpdateAutomationInput & { bufferPostId: string | null };

export interface DraftDefaults {
  channelId?: string | null;
  bufferPostId?: string | null;
}

export function emptyDraft({
  channelId = null,
  bufferPostId = null,
}: DraftDefaults = {}): AutomationDraft {
  return {
    name: '',
    channelId: channelId ?? '',
    triggerType: 'COMMENT',
    postScope: bufferPostId ? 'BUFFER_POST' : 'ANY',
    mediaIds: [],
    bufferPostId,
    matchMode: 'KEYWORDS',
    keywords: [],
    wholeWord: true,
    oncePerContact: true,
    response: {
      publicReply: { enabled: false, variants: [] },
      message: { text: '', buttons: [] },
      opening: { enabled: false, text: '', buttonLabel: '' },
      followGate: { enabled: false, text: '', buttonLabel: '' },
    },
  };
}

export function draftFromAutomation(automation: AutomationDto): AutomationDraft {
  return {
    name: automation.name,
    channelId: automation.channelId,
    triggerType: automation.triggerType,
    postScope: automation.postScope,
    mediaIds: automation.mediaIds,
    bufferPostId: automation.bufferPostId,
    matchMode: automation.matchMode,
    keywords: automation.keywords,
    wholeWord: automation.wholeWord,
    oncePerContact: automation.oncePerContact,
    response: {
      publicReply: {
        ...automation.response.publicReply,
        variants: [...automation.response.publicReply.variants],
      },
      message: {
        text: automation.response.message.text,
        buttons: automation.response.message.buttons.map((b) => ({ ...b })),
      },
      opening: { ...automation.response.opening },
      followGate: { ...automation.response.followGate },
    },
  };
}

/**
 * The body to send. Options that only apply to comments are cleared for a
 * message trigger, so the schema does not refuse a public reply nobody can see.
 */
export function draftToInput(draft: AutomationDraft): unknown {
  const isComment = draft.triggerType === 'COMMENT';
  return {
    ...draft,
    postScope: isComment ? draft.postScope : 'ANY',
    mediaIds: isComment && draft.postScope === 'SPECIFIC' ? draft.mediaIds : [],
    bufferPostId: isComment && draft.postScope === 'BUFFER_POST' ? draft.bufferPostId : null,
    response: {
      ...draft.response,
      publicReply: isComment ? draft.response.publicReply : { enabled: false, variants: [] },
    },
  };
}
