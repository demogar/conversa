'use client';

import { LIMITS, type LinkButton } from '@conversa/shared';
import { Button, Field, Fieldset, IconButton, Input, Stack, Text } from '@demogar/mola-ui';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface LinkButtonsEditorProps {
  buttons: LinkButton[];
  onChange: (buttons: LinkButton[]) => void;
  /** The error for a dotted path (`response.message.buttons.0.url`), given the field's value. */
  errorFor: (path: string, value: string) => string | undefined;
}

/** Up to three buttons under the direct message, each a label and a web address. */
export function LinkButtonsEditor({ buttons, onChange, errorFor }: LinkButtonsEditorProps) {
  const t = useTranslations('automations.builder.response');

  function update(index: number, patch: Partial<LinkButton>) {
    onChange(buttons.map((button, i) => (i === index ? { ...button, ...patch } : button)));
  }

  return (
    <Stack gap="md">
      <div>
        <Text weight="medium">{t('buttons')}</Text>
        <Text size="sm" variant="secondary">
          {buttons.length === 0 ? t('buttonsEmpty') : t('buttonsHint', { max: LIMITS.dmButtons })}
        </Text>
      </div>
      {buttons.map((button, index) => {
        const path = `response.message.buttons.${index}`;
        return (
          <Fieldset key={index} legend={t('button', { number: index + 1 })}>
            <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto]">
              <Field
                label={t('buttonLabel')}
                required
                error={errorFor(`${path}.label`, button.label)}
                labelAside={
                  <Text as="span" size="xs" variant="muted" tabular>
                    {t('characters', { count: button.label.length, max: LIMITS.buttonLabelLength })}
                  </Text>
                }
              >
                {(control) => (
                  <Input
                    {...control}
                    value={button.label}
                    maxLength={LIMITS.buttonLabelLength}
                    placeholder={t('buttonLabelPlaceholder')}
                    onChange={(event) => update(index, { label: event.target.value })}
                  />
                )}
              </Field>
              <Field label={t('buttonUrl')} required error={errorFor(`${path}.url`, button.url)}>
                {(control) => (
                  <Input
                    {...control}
                    type="url"
                    inputMode="url"
                    value={button.url}
                    maxLength={LIMITS.urlLength}
                    placeholder={t('buttonUrlPlaceholder')}
                    onChange={(event) => update(index, { url: event.target.value })}
                  />
                )}
              </Field>
              <IconButton
                type="button"
                variant="ghost"
                label={t('removeButton', { number: index + 1 })}
                className="sm:mt-7"
                onClick={() => onChange(buttons.filter((_, i) => i !== index))}
              >
                <Trash2 />
              </IconButton>
            </div>
          </Fieldset>
        );
      })}
      {buttons.length < LIMITS.dmButtons ? (
        <div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={<Plus />}
            onClick={() => onChange([...buttons, { label: '', url: '' }])}
          >
            {t('addButton')}
          </Button>
        </div>
      ) : null}
    </Stack>
  );
}
