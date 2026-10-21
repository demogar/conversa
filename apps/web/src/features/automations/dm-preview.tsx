'use client';

import { renderTemplate } from '@conversa/shared';
import { Heading, Panel, Stack, Text } from '@demogar/mola-ui';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { AutomationDraft } from './draft';

/** One message from the account: its text and the buttons under it, drawn but not pressable. */
function Bubble({ step, text, buttons }: { step: string; text: string; buttons: string[] }) {
  return (
    <div className="flex max-w-[88%] flex-col gap-1 self-start">
      <Text as="span" size="xs" variant="muted">
        {step}
      </Text>
      <Panel layer="cloth" padding="none">
        <Text className="whitespace-pre-wrap break-words px-3 py-2">{text}</Text>
        {buttons.map((label, index) => (
          <Text
            key={index}
            as="span"
            size="sm"
            weight="semibold"
            className="block px-3 py-2 text-center rule-t"
          >
            {label}
          </Text>
        ))}
      </Panel>
    </div>
  );
}

/** What the contact says or does, on the other side of the conversation. */
function ContactLine({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-[88%] self-end">
      <Panel layer="shade" padding="sm">
        <Text size="sm">{children}</Text>
      </Panel>
    </div>
  );
}

/** The automation as the person meets it: their comment, then each message in order. */
export function DmPreview({ draft }: { draft: AutomationDraft }) {
  const t = useTranslations('automations.builder.preview');
  const username = t('sampleUsername');
  const fill = (text: string) => renderTemplate(text, { username });
  const { response } = draft;
  const isComment = draft.triggerType === 'COMMENT';
  const trigger =
    draft.matchMode === 'KEYWORDS' && draft.keywords[0] ? draft.keywords[0] : t('sampleAnything');
  const firstVariant = response.publicReply.variants.find((variant) => variant.trim());
  const buttonLabel = (label: string) => label.trim() || t('emptyButton');

  return (
    <Panel as="section" aria-labelledby="automation-preview-title" layer="pale">
      <Stack gap="md">
        <div>
          <Heading level={2} visualLevel={3} id="automation-preview-title">
            {t('title')}
          </Heading>
          <Text size="sm" variant="secondary">
            {t('description')}
          </Text>
        </div>
        <Panel layer="shade" edge="none" padding="sm">
          <div className="flex flex-col gap-3">
            <Text as="span" size="xs" variant="muted" className="self-end">
              <span className="literal">@{username}</span> ·{' '}
              {isComment ? t('commentOn') : t('messageFrom')}
            </Text>
            <ContactLine>{trigger}</ContactLine>
            {isComment && response.publicReply.enabled && firstVariant ? (
              <Bubble step={t('publicReply')} text={fill(firstVariant)} buttons={[]} />
            ) : null}
            {response.opening.enabled ? (
              <>
                <Bubble
                  step={t('opening')}
                  text={fill(response.opening.text) || t('emptyMessage')}
                  buttons={[buttonLabel(response.opening.buttonLabel)]}
                />
                <ContactLine>
                  {t('taps', { label: buttonLabel(response.opening.buttonLabel) })}
                </ContactLine>
              </>
            ) : null}
            {response.followGate.enabled ? (
              <>
                <Bubble
                  step={t('followGate')}
                  text={fill(response.followGate.text) || t('emptyMessage')}
                  buttons={[buttonLabel(response.followGate.buttonLabel)]}
                />
                <ContactLine>
                  {t('taps', { label: buttonLabel(response.followGate.buttonLabel) })}
                </ContactLine>
              </>
            ) : null}
            <Bubble
              step={
                response.opening.enabled || response.followGate.enabled ? t('content') : t('dm')
              }
              text={fill(response.message.text) || t('emptyMessage')}
              buttons={response.message.buttons.map((button) => buttonLabel(button.label))}
            />
          </div>
        </Panel>
      </Stack>
    </Panel>
  );
}
