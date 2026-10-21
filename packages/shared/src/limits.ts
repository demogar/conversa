/** Limits imposed by the messaging platforms or by Conversa itself. */
export const LIMITS = {
  keywordsPerAutomation: 20,
  keywordLength: 50,
  publicReplyVariants: 5,
  publicReplyLength: 300,
  /** Instagram's button template caps the text at 640 characters. */
  dmTextLength: 640,
  /** Instagram allows up to three buttons in a button template. */
  dmButtons: 3,
  /** Instagram caps a button title at 20 characters. */
  buttonLabelLength: 20,
  urlLength: 2000,
  mediaIdsPerAutomation: 20,
  automationNameLength: 80,
  workspaceNameLength: 60,
  passwordMinLength: 12,
  passwordMaxLength: 128,
} as const;
