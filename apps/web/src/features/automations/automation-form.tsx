'use client';

import {
  type AutomationDto,
  type ChannelDto,
  type CreateAutomationInput,
  createAutomationSchema,
  LIMITS,
  matchKeywords,
  type UpdateAutomationInput,
  updateAutomationSchema,
} from '@conversa/shared';
import {
  Badge,
  Button,
  Callout,
  Field,
  Form,
  FormErrorSummary,
  Heading,
  IconButton,
  Input,
  Link,
  Panel,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
} from '@demogar/mola-ui';
import { Plus, Trash2 } from 'lucide-react';
import NextLink from 'next/link';
import { useTranslations } from 'next-intl';
import { type FormEvent, type ReactNode, useId, useRef, useState } from 'react';
import { ApiError } from '@/lib/api/client';
import { useBufferStatusForPicker } from '@/lib/api/hooks/automations';
import { type FieldErrors, useErrorMessage, useFieldErrors } from '@/lib/errors';
import { workspacePath } from '@/lib/navigation';
import { BufferPostField } from './buffer-post-field';
import { DmPreview } from './dm-preview';
import { type AutomationDraft, draftToInput } from './draft';
import { KeywordsEditor } from './keywords-editor';
import { LinkButtonsEditor } from './link-buttons-editor';
import { PostPicker } from './post-picker';

type Response = AutomationDraft['response'];

export type SaveIntent = 'DRAFT' | 'ACTIVE' | 'UPDATE';

interface AutomationFormProps {
  workspaceId: string;
  channels: ChannelDto[];
  initial: AutomationDraft;
  /** The saved automation when editing; absent when creating. */
  automation?: AutomationDto;
  saving: boolean;
  saveError: unknown;
  onSave: (
    input: CreateAutomationInput | UpdateAutomationInput,
    intent: SaveIntent,
  ) => Promise<unknown>;
}

/** A refusal the form can show next to its fields. */
function isFieldError(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    error.code === 'VALIDATION_FAILED' &&
    Object.keys(error.fields).length > 0
  );
}

/** A titled region of the form, cut as its own panel. */
function FormSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <Panel as="section" aria-labelledby={id} padding="lg">
      <Stack gap="lg">
        <Heading level={2} visualLevel={3} id={id}>
          {title}
        </Heading>
        {children}
      </Stack>
    </Panel>
  );
}

function CharacterCount({ count, max }: { count: number; max: number }) {
  const t = useTranslations('automations.builder.response');
  return (
    <Text as="span" size="xs" variant="muted" tone={count > max ? 'danger' : undefined} tabular>
      {t('characters', { count, max })}
    </Text>
  );
}

export function AutomationForm({
  workspaceId,
  channels,
  initial,
  automation,
  saving,
  saveError,
  onSave,
}: AutomationFormProps) {
  const t = useTranslations('automations.builder');
  const tErrors = useTranslations('errors.fields');
  const errorMessage = useErrorMessage();
  const toFieldErrors = useFieldErrors();
  const ids = useId();
  const summaryRef = useRef<HTMLDivElement>(null);
  const intent = useRef<SaveIntent>(automation ? 'UPDATE' : 'DRAFT');

  const [draft, setDraft] = useState<AutomationDraft>(initial);
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [testText, setTestText] = useState('');
  // Which button was pressed, for its working state; the ref is what the submit handler reads.
  const [savingIntent, setSavingIntent] = useState<SaveIntent>(automation ? 'UPDATE' : 'DRAFT');

  function validate(value: AutomationDraft, status: 'DRAFT' | 'ACTIVE' = 'DRAFT') {
    const body = draftToInput(value);
    const parsed = automation
      ? updateAutomationSchema.safeParse(body)
      : createAutomationSchema.safeParse({ ...(body as object), status });
    if (parsed.success) return { data: parsed.data, errors: {} };
    const next = toFieldErrors(parsed.error);
    if (next.name) next.name = t('errors.nameRequired');
    if (next.channelId) next.channelId = t('errors.channelRequired');
    return { data: null, errors: next };
  }

  // After the first Save, the form re-checks as it changes, so a fixed field stops saying it is wrong.
  const errors: FieldErrors = { ...(submitted ? validate(draft).errors : {}), ...serverErrors };

  const bufferStatus = useBufferStatusForPicker(workspaceId);
  const bufferMissing = bufferStatus.data?.connected === false;
  // Offered once Buffer is known to be connected, so the option never appears and then vanishes.
  const bufferOffered = bufferStatus.data?.connected === true || draft.postScope === 'BUFFER_POST';

  const update = (patch: Partial<AutomationDraft>) => {
    setServerErrors({});
    setDraft((current) => ({ ...current, ...patch }));
  };
  const updateResponse = <K extends keyof Response>(key: K, patch: Partial<Response[K]>) => {
    setServerErrors({});
    setDraft((current) => ({
      ...current,
      response: { ...current.response, [key]: { ...current.response[key], ...patch } },
    }));
  };

  /** The error for a path, worded as "required" when the field is simply empty. */
  const errorFor = (path: string, value?: string) => {
    const error = errors[path];
    if (!error) return undefined;
    return value !== undefined && !value.trim() ? tErrors('required') : error;
  };

  const isComment = draft.triggerType === 'COMMENT';
  const { response } = draft;
  const selectableChannels = channels.filter((channel) => channel.status !== 'DISCONNECTED');
  const channelItems = selectableChannels.map((channel) => ({
    value: channel.id,
    label: `@${channel.username}`,
    description:
      channel.status === 'NEEDS_REAUTH'
        ? t('basics.channelNeedsReauth')
        : (channel.displayName ?? undefined),
  }));

  const test = testText.trim()
    ? draft.matchMode === 'ANYTHING'
      ? { matched: true, keyword: null }
      : matchKeywords(testText, draft.keywords, draft.wholeWord)
    : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setServerErrors({});
    const chosen = intent.current;
    setSavingIntent(chosen);
    const { data } = validate(draft, chosen === 'ACTIVE' ? 'ACTIVE' : 'DRAFT');
    if (!data) return;
    try {
      await onSave(data, chosen);
    } catch (error) {
      if (isFieldError(error)) {
        setServerErrors(toFieldErrors(error));
        // Errors from the server arrive after the submit, so focus is moved by hand.
        requestAnimationFrame(() => summaryRef.current?.focus());
      }
    }
  }

  const serverError = saveError && !isFieldError(saveError) ? errorMessage(saveError) : null;

  return (
    <div className="@container">
      <div className="grid grid-cols-1 items-start gap-6 @4xl:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
        <Form onSubmit={submit} aria-label={t('formLabel')} noValidate>
          <Stack gap="lg">
            <FormErrorSummary ref={summaryRef} description={t('summaryDescription')} />
            {serverError ? <Callout tone="danger">{serverError}</Callout> : null}

            <FormSection id={`${ids}-basics`} title={t('basics.title')}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label={t('basics.name')}
                  required
                  hint={t('basics.nameHint')}
                  error={errors.name}
                >
                  {(control) => (
                    <Input
                      {...control}
                      value={draft.name}
                      maxLength={LIMITS.automationNameLength}
                      placeholder={t('basics.namePlaceholder')}
                      onChange={(event) => update({ name: event.target.value })}
                      autoComplete="off"
                    />
                  )}
                </Field>
                <Field label={t('basics.channel')} required error={errors.channelId}>
                  {(control) => (
                    <Select
                      {...control}
                      items={channelItems}
                      value={draft.channelId || null}
                      placeholder={t('basics.channelPlaceholder')}
                      onValueChange={(channelId) =>
                        // Posts belong to one account, so a new account starts with none picked.
                        update({ channelId: channelId ?? '', mediaIds: [] })
                      }
                    />
                  )}
                </Field>
              </div>
            </FormSection>

            <FormSection id={`${ids}-trigger`} title={t('trigger.title')}>
              <RadioGroup
                label={t('trigger.type')}
                value={draft.triggerType}
                onValueChange={(value) =>
                  update({ triggerType: value as AutomationDraft['triggerType'] })
                }
              >
                <Radio
                  value="COMMENT"
                  label={t('trigger.comment')}
                  description={t('trigger.commentHint')}
                />
                <Radio
                  value="MESSAGE"
                  label={t('trigger.message')}
                  description={t('trigger.messageHint')}
                />
              </RadioGroup>

              {isComment ? (
                <Stack gap="md">
                  <RadioGroup
                    label={t('trigger.scope')}
                    value={draft.postScope}
                    onValueChange={(value) =>
                      update({ postScope: value as AutomationDraft['postScope'] })
                    }
                  >
                    <Radio
                      value="ANY"
                      label={t('trigger.scopeAny')}
                      description={t('trigger.scopeAnyDescription')}
                    />
                    <Radio
                      value="SPECIFIC"
                      label={t('trigger.scopeSpecific')}
                      description={t('trigger.scopeSpecificDescription')}
                    />
                    <Radio
                      value="NEXT_POST"
                      label={t('trigger.scopeNext')}
                      description={t('trigger.scopeNextDescription')}
                    />
                    {bufferOffered ? (
                      <Radio
                        value="BUFFER_POST"
                        label={t('trigger.scopeBuffer')}
                        description={t('trigger.scopeBufferDescription')}
                      />
                    ) : null}
                  </RadioGroup>
                  {bufferMissing ? (
                    <Text size="sm" variant="secondary">
                      {t('trigger.bufferNotConnected')}{' '}
                      <Link
                        render={
                          <NextLink href={workspacePath(workspaceId, '/settings/integrations')} />
                        }
                      >
                        {t('trigger.bufferConnect')}
                      </Link>
                    </Text>
                  ) : null}
                  {draft.postScope === 'SPECIFIC' ? (
                    <PostPicker
                      workspaceId={workspaceId}
                      channelId={draft.channelId || null}
                      value={draft.mediaIds}
                      onChange={(mediaIds) => update({ mediaIds })}
                      error={errors.mediaIds}
                    />
                  ) : null}
                  {draft.postScope === 'BUFFER_POST' ? (
                    <BufferPostField
                      workspaceId={workspaceId}
                      channelId={draft.channelId || null}
                      value={draft.bufferPostId}
                      onChange={(bufferPostId) => update({ bufferPostId })}
                      error={errors.bufferPostId}
                      connected={!bufferMissing}
                    />
                  ) : null}
                </Stack>
              ) : null}
            </FormSection>

            <FormSection id={`${ids}-match`} title={t('match.title')}>
              <RadioGroup
                label={t('match.mode')}
                value={draft.matchMode}
                onValueChange={(value) =>
                  update({ matchMode: value as AutomationDraft['matchMode'] })
                }
              >
                <Radio
                  value="KEYWORDS"
                  label={t('match.keywords')}
                  description={t('match.keywordsDescription')}
                />
                <Radio
                  value="ANYTHING"
                  label={t('match.anything')}
                  description={t('match.anythingDescription')}
                />
              </RadioGroup>
              {draft.matchMode === 'KEYWORDS' ? (
                <>
                  <KeywordsEditor
                    keywords={draft.keywords}
                    onChange={(keywords) => update({ keywords })}
                    error={errors.keywords}
                  />
                  <Switch
                    label={t('match.wholeWord')}
                    description={t('match.wholeWordDescription')}
                    checked={draft.wholeWord}
                    onCheckedChange={(wholeWord) => update({ wholeWord })}
                  />
                </>
              ) : null}
              <Field
                label={t('match.test')}
                optional
                hint={t('match.testHint')}
                labelAside={
                  test ? (
                    <span role="status">
                      <Badge tone={test.matched ? 'success' : 'neutral'} dot>
                        {test.matched
                          ? test.keyword
                            ? t('match.testMatched', { keyword: test.keyword })
                            : t('match.testMatchedAny')
                          : t('match.testNoMatch')}
                      </Badge>
                    </span>
                  ) : null
                }
              >
                {(control) => (
                  <Input
                    {...control}
                    value={testText}
                    placeholder={t('match.testPlaceholder')}
                    onChange={(event) => setTestText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.preventDefault();
                    }}
                    autoComplete="off"
                  />
                )}
              </Field>
              <Switch
                label={t('match.oncePerContact')}
                description={t('match.oncePerContactDescription')}
                checked={draft.oncePerContact}
                onCheckedChange={(oncePerContact) => update({ oncePerContact })}
              />
            </FormSection>

            <FormSection id={`${ids}-response`} title={t('response.title')}>
              {isComment ? (
                <Stack gap="md">
                  <Switch
                    label={t('response.publicReply')}
                    description={t('response.publicReplyDescription')}
                    checked={response.publicReply.enabled}
                    onCheckedChange={(enabled) =>
                      updateResponse('publicReply', {
                        enabled,
                        variants:
                          enabled && response.publicReply.variants.length === 0
                            ? ['']
                            : response.publicReply.variants,
                      })
                    }
                  />
                  {response.publicReply.enabled ? (
                    <Stack gap="sm" className="ps-4 rule-s">
                      {response.publicReply.variants.map((variant, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <Field
                            className="min-w-0 flex-1"
                            label={t('response.variant', { number: index + 1 })}
                            required
                            error={errorFor(`response.publicReply.variants.${index}`, variant)}
                          >
                            {(control) => (
                              <Input
                                {...control}
                                value={variant}
                                maxLength={LIMITS.publicReplyLength}
                                placeholder={t('response.variantPlaceholder')}
                                onChange={(event) =>
                                  updateResponse('publicReply', {
                                    variants: response.publicReply.variants.map((v, i) =>
                                      i === index ? event.target.value : v,
                                    ),
                                  })
                                }
                              />
                            )}
                          </Field>
                          {response.publicReply.variants.length > 1 ? (
                            <IconButton
                              type="button"
                              variant="ghost"
                              className="mt-7"
                              label={t('response.removeVariant', { number: index + 1 })}
                              onClick={() =>
                                updateResponse('publicReply', {
                                  variants: response.publicReply.variants.filter(
                                    (_, i) => i !== index,
                                  ),
                                })
                              }
                            >
                              <Trash2 />
                            </IconButton>
                          ) : null}
                        </div>
                      ))}
                      {errors['response.publicReply.variants'] ? (
                        <Text size="sm" tone="danger">
                          {errors['response.publicReply.variants']}
                        </Text>
                      ) : null}
                      {response.publicReply.variants.length < LIMITS.publicReplyVariants ? (
                        <div>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            icon={<Plus />}
                            onClick={() =>
                              updateResponse('publicReply', {
                                variants: [...response.publicReply.variants, ''],
                              })
                            }
                          >
                            {t('response.addVariant')}
                          </Button>
                        </div>
                      ) : null}
                    </Stack>
                  ) : null}
                </Stack>
              ) : null}

              <Stack gap="md">
                <Switch
                  label={t('response.opening')}
                  description={t('response.openingDescription')}
                  checked={response.opening.enabled}
                  onCheckedChange={(enabled) => updateResponse('opening', { enabled })}
                />
                {response.opening.enabled ? (
                  <div className="grid grid-cols-1 gap-4 ps-4 rule-s">
                    <Field
                      label={t('response.openingText')}
                      required
                      error={errorFor('response.opening.text', response.opening.text)}
                      labelAside={
                        <CharacterCount
                          count={response.opening.text.length}
                          max={LIMITS.dmTextLength}
                        />
                      }
                    >
                      {(control) => (
                        <Textarea
                          {...control}
                          autosize
                          rows={2}
                          value={response.opening.text}
                          placeholder={t('response.openingPlaceholder', { username: '{username}' })}
                          onChange={(event) =>
                            updateResponse('opening', { text: event.target.value })
                          }
                        />
                      )}
                    </Field>
                    <Field
                      label={t('response.buttonLabel')}
                      required
                      error={errorFor('response.opening.buttonLabel', response.opening.buttonLabel)}
                      labelAside={
                        <CharacterCount
                          count={response.opening.buttonLabel.length}
                          max={LIMITS.buttonLabelLength}
                        />
                      }
                    >
                      {(control) => (
                        <Input
                          {...control}
                          value={response.opening.buttonLabel}
                          maxLength={LIMITS.buttonLabelLength}
                          placeholder={t('response.openingButtonPlaceholder')}
                          onChange={(event) =>
                            updateResponse('opening', { buttonLabel: event.target.value })
                          }
                          className="sm:max-w-80"
                        />
                      )}
                    </Field>
                  </div>
                ) : null}
              </Stack>

              <Stack gap="md">
                <Switch
                  label={t('response.followGate')}
                  description={t('response.followGateDescription')}
                  checked={response.followGate.enabled}
                  onCheckedChange={(enabled) => updateResponse('followGate', { enabled })}
                />
                {response.followGate.enabled ? (
                  <div className="grid grid-cols-1 gap-4 ps-4 rule-s">
                    <Field
                      label={t('response.followText')}
                      required
                      error={errorFor('response.followGate.text', response.followGate.text)}
                      labelAside={
                        <CharacterCount
                          count={response.followGate.text.length}
                          max={LIMITS.dmTextLength}
                        />
                      }
                    >
                      {(control) => (
                        <Textarea
                          {...control}
                          autosize
                          rows={2}
                          value={response.followGate.text}
                          placeholder={t('response.followPlaceholder')}
                          onChange={(event) =>
                            updateResponse('followGate', { text: event.target.value })
                          }
                        />
                      )}
                    </Field>
                    <Field
                      label={t('response.buttonLabel')}
                      required
                      error={errorFor(
                        'response.followGate.buttonLabel',
                        response.followGate.buttonLabel,
                      )}
                      labelAside={
                        <CharacterCount
                          count={response.followGate.buttonLabel.length}
                          max={LIMITS.buttonLabelLength}
                        />
                      }
                    >
                      {(control) => (
                        <Input
                          {...control}
                          value={response.followGate.buttonLabel}
                          maxLength={LIMITS.buttonLabelLength}
                          placeholder={t('response.followButtonPlaceholder')}
                          onChange={(event) =>
                            updateResponse('followGate', { buttonLabel: event.target.value })
                          }
                          className="sm:max-w-80"
                        />
                      )}
                    </Field>
                  </div>
                ) : null}
              </Stack>

              <Field
                label={t('response.message')}
                required
                hint={t('response.messageHint', { username: '{username}' })}
                error={errorFor('response.message.text', response.message.text)}
                labelAside={
                  <CharacterCount count={response.message.text.length} max={LIMITS.dmTextLength} />
                }
              >
                {(control) => (
                  <Textarea
                    {...control}
                    autosize
                    rows={4}
                    value={response.message.text}
                    placeholder={t('response.messagePlaceholder', { username: '{username}' })}
                    onChange={(event) => updateResponse('message', { text: event.target.value })}
                  />
                )}
              </Field>

              <LinkButtonsEditor
                buttons={response.message.buttons}
                onChange={(buttons) => updateResponse('message', { buttons })}
                errorFor={errorFor}
              />
            </FormSection>

            {/* On a phone the buttons stack full width, the main one on top. */}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
              {automation ? (
                <Button type="submit" loading={saving} onClick={() => (intent.current = 'UPDATE')}>
                  {t('saveChanges')}
                </Button>
              ) : (
                <>
                  <Button
                    type="submit"
                    variant="secondary"
                    loading={saving && savingIntent === 'DRAFT'}
                    disabled={saving && savingIntent !== 'DRAFT'}
                    onClick={() => (intent.current = 'DRAFT')}
                  >
                    {t('saveDraft')}
                  </Button>
                  <Button
                    type="submit"
                    loading={saving && savingIntent === 'ACTIVE'}
                    disabled={saving && savingIntent !== 'ACTIVE'}
                    onClick={() => (intent.current = 'ACTIVE')}
                  >
                    {t('saveActivate')}
                  </Button>
                </>
              )}
            </div>
          </Stack>
        </Form>

        <aside className="@4xl:sticky @4xl:top-6">
          <DmPreview draft={draft} />
        </aside>
      </div>
    </div>
  );
}
