'use client';

import { LIMITS } from '@conversa/shared';
import { Button, Field, Inline, Input, Stack, TagGroup } from '@demogar/mola-ui';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type KeyboardEvent, useState } from 'react';

interface KeywordsEditorProps {
  keywords: string[];
  onChange: (keywords: string[]) => void;
  error?: string;
}

/** Keywords typed one at a time into a field, kept as removable tags. */
export function KeywordsEditor({ keywords, onChange, error }: KeywordsEditorProps) {
  const t = useTranslations('automations.builder.match');
  const [text, setText] = useState('');
  const full = keywords.length >= LIMITS.keywordsPerAutomation;

  function add() {
    const keyword = text.trim().slice(0, LIMITS.keywordLength);
    if (!keyword || full) return;
    const exists = keywords.some((current) => current.toLocaleLowerCase() === keyword.toLocaleLowerCase());
    if (!exists) onChange([...keywords, keyword]);
    setText('');
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    // Enter adds the keyword; it must not submit the whole automation.
    event.preventDefault();
    add();
  }

  return (
    <Stack gap="sm">
      <Field
        label={t('keywordInput')}
        required
        error={error}
        hint={full ? t('keywordsFull', { max: LIMITS.keywordsPerAutomation }) : t('keywordHint', { max: LIMITS.keywordsPerAutomation })}
      >
        {(control) => (
          <Inline gap="sm" wrap={false}>
            <Input
              {...control}
              required={false}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={onKeyDown}
              maxLength={LIMITS.keywordLength}
              placeholder={t('keywordPlaceholder')}
              disabled={full}
              autoComplete="off"
              className="min-w-0 flex-1"
            />
            <Button type="button" variant="secondary" icon={<Plus />} onClick={add} disabled={full || !text.trim()}>
              {t('keywordAdd')}
            </Button>
          </Inline>
        )}
      </Field>
      <TagGroup
        aria-label={t('keywordListAria')}
        items={keywords.map((keyword) => ({ value: keyword, label: keyword }))}
        onRemove={(value) => onChange(keywords.filter((keyword) => keyword !== value))}
        removeLabel={(label) => t('keywordRemove', { label })}
        empty={t('keywordsEmpty')}
      />
    </Stack>
  );
}
