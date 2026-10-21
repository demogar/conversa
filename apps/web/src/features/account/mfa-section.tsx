'use client';

import {
  Badge,
  Button,
  Callout,
  CodeBlock,
  Dialog,
  DialogContent,
  Field,
  Form,
  Heading,
  Input,
  useToast,
} from '@demogar/mola-ui';
import { disableMfaSchema, type MfaSetupDto, totpCodeSchema } from '@conversa/shared';
import { ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { SettingsSection } from '@/features/settings/settings-section';
import {
  useDisableMfa,
  useEnableMfa,
  useStartMfa,
} from '@/lib/api/hooks/account';
import { type FieldErrors, useErrorMessage, useFieldErrors } from '@/lib/errors';

/**
 * Two-step verification: start → scan and confirm a code → recovery codes,
 * shown once. Turning it off asks for the password.
 */
export function MfaSection({ enabled }: { enabled: boolean }) {
  const t = useTranslations('account.mfa');
  const errorMessage = useErrorMessage();
  const start = useStartMfa();
  const [setup, setSetup] = useState<MfaSetupDto | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  function begin() {
    start.mutate(undefined, { onSuccess: setSetup });
  }

  // The codes come first: `enabled` turns true as soon as they arrive.
  let body;
  if (recoveryCodes) {
    body = <RecoveryCodes codes={recoveryCodes} onDone={() => setRecoveryCodes(null)} />;
  } else if (enabled) {
    body = <EnabledState />;
  } else if (setup) {
    body = (
      <SetupSteps
        setup={setup}
        onCancel={() => setSetup(null)}
        onEnabled={(codes) => {
          setSetup(null);
          setRecoveryCodes(codes);
        }}
      />
    );
  } else {
    body = (
      <>
        <StatusLine enabled={false} />
        <p className="m-0 text-sm text-ink-2">{t('offDescription')}</p>
        {start.error ? <Callout tone="danger">{errorMessage(start.error)}</Callout> : null}
        <div>
          <Button icon={<ShieldCheck />} loading={start.isPending} onClick={begin}>
            {t('start')}
          </Button>
        </div>
      </>
    );
  }

  return (
    <SettingsSection id="account-mfa" title={t('title')} description={t('description')}>
      <div aria-live="polite" className="flex flex-col gap-5">
        {body}
      </div>
    </SettingsSection>
  );
}

function StatusLine({ enabled }: { enabled: boolean }) {
  const t = useTranslations('account.mfa');
  return (
    <p className="m-0 flex items-center gap-2 text-sm">
      <span className="font-semibold text-ink">{t('status')}</span>
      <Badge dot tone={enabled ? 'success' : 'neutral'}>
        {enabled ? t('on') : t('off')}
      </Badge>
    </p>
  );
}

function SetupSteps({
  setup,
  onCancel,
  onEnabled,
}: {
  setup: MfaSetupDto;
  onCancel: () => void;
  onEnabled: (codes: string[]) => void;
}) {
  const t = useTranslations('account.mfa');
  const enable = useEnableMfa();
  const errorMessage = useErrorMessage();
  const toFieldErrors = useFieldErrors();
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = totpCodeSchema.safeParse({ code });
    setErrors(parsed.success ? {} : toFieldErrors(parsed.error));
    if (!parsed.success) return;
    enable.mutate(parsed.data.code, { onSuccess: (result) => onEnabled(result.recoveryCodes) });
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <Heading level={3} visualLevel={4}>
          {t('scanTitle')}
        </Heading>
        <p className="m-0 text-sm text-ink-2">{t('scanDescription')}</p>
        {/* An image, not inline markup: the SVG comes from the server and is never parsed into the page. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/svg+xml;utf8,${encodeURIComponent(setup.qrSvg)}`}
          alt={t('qrAlt')}
          width={180}
          height={180}
        />
        <CodeBlock label={t('secretLabel')} code={setup.secret} wrap />
      </div>
      <Form onSubmit={submit} aria-label={t('formLabel')}>
        <div className="flex flex-col gap-5">
          <Heading level={3} visualLevel={4}>
            {t('codeTitle')}
          </Heading>
          {enable.error ? <Callout tone="danger">{errorMessage(enable.error)}</Callout> : null}
          <Field label={t('code')} required error={errors.code}>
            {(control) => (
              <Input
                {...control}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                className="literal"
              />
            )}
          </Field>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onCancel}>
              {t('cancel')}
            </Button>
            <Button type="submit" loading={enable.isPending}>
              {t('enable')}
            </Button>
          </div>
        </div>
      </Form>
    </>
  );
}

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const t = useTranslations('account.mfa');
  return (
    <>
      <StatusLine enabled />
      <Callout tone="warn" headingLevel={3} title={t('recoveryTitle')}>
        {t('recoveryDescription')}
      </Callout>
      <CodeBlock label={t('recoveryLabel')} code={codes.join('\n')} />
      <div className="flex justify-end">
        <Button onClick={onDone}>{t('recoveryDone')}</Button>
      </div>
    </>
  );
}

function EnabledState() {
  const t = useTranslations('account.mfa');
  const tCommon = useTranslations('common.actions');
  const toast = useToast();
  const disable = useDisableMfa();
  const errorMessage = useErrorMessage();
  const toFieldErrors = useFieldErrors();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});

  function openDialog(next: boolean) {
    setOpen(next);
    if (next) {
      setPassword('');
      setErrors({});
      disable.reset();
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = disableMfaSchema.safeParse({ password });
    setErrors(parsed.success ? {} : toFieldErrors(parsed.error));
    if (!parsed.success) return;
    disable.mutate(parsed.data.password, {
      onSuccess: () => {
        setOpen(false);
        toast.show({ title: t('disabled') });
      },
    });
  }

  return (
    <>
      <StatusLine enabled />
      <p className="m-0 text-sm text-ink-2">{t('onDescription')}</p>
      <div>
        <Button variant="secondary" onClick={() => openDialog(true)}>
          {t('disable')}
        </Button>
      </div>
      <Dialog open={open} onOpenChange={openDialog}>
        <DialogContent
          size="sm"
          title={t('disableTitle')}
          description={t('disableDescription')}
          footer={
            <>
              <Button variant="ghost" onClick={() => openDialog(false)}>
                {tCommon('cancel')}
              </Button>
              <Button type="submit" form="disable-mfa" variant="danger" loading={disable.isPending}>
                {t('disableConfirm')}
              </Button>
            </>
          }
        >
          <Form id="disable-mfa" onSubmit={submit} aria-label={t('disableTitle')}>
            <div className="flex flex-col gap-4">
              {disable.error ? (
                <Callout tone="danger">{errorMessage(disable.error)}</Callout>
              ) : null}
              <Field label={t('disablePassword')} required error={errors.password}>
                {(control) => (
                  <Input
                    {...control}
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    autoFocus
                  />
                )}
              </Field>
            </div>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
