'use client';

import {
  Button,
  Callout,
  Dialog,
  DialogContent,
  Field,
  Form,
  Input,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Textarea,
  useToast,
} from '@demogar/mola-ui';
import { type ChannelDto, type MediaDto, simulateEventSchema } from '@conversa/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { type FormEvent, useId, useState } from 'react';
import { useChannelMedia, useSimulateEvent } from '@/lib/api/hooks/channels';
import { type FieldErrors, useErrorMessage, useFieldErrors } from '@/lib/errors';

type Kind = 'comment' | 'message';

const CAPTION_LENGTH = 60;

export function SimulateEventDialog({
  workspaceId,
  channel,
  open,
  onOpenChange,
}: {
  workspaceId: string;
  channel: ChannelDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('channels.simulateDialog');
  const tCommon = useTranslations('common.actions');
  const format = useFormatter();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const toFieldErrors = useFieldErrors();
  const formId = useId();

  const [kind, setKind] = useState<Kind>('comment');
  const [username, setUsername] = useState('');
  const [text, setText] = useState('');
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  const media = useChannelMedia(workspaceId, channel.id, open && kind === 'comment');
  const simulate = useSimulateEvent(workspaceId, channel.id);

  const mediaLabel = (item: MediaDto) => {
    const caption = item.caption?.trim();
    if (!caption)
      return t('mediaUntitled', {
        date: format.dateTime(new Date(item.publishedAt), { dateStyle: 'medium' }),
      });
    return caption.length > CAPTION_LENGTH ? `${caption.slice(0, CAPTION_LENGTH)}…` : caption;
  };

  function close(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setErrors({});
      simulate.reset();
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = simulateEventSchema.safeParse({
      kind,
      username: username.replace(/^@/, ''),
      text,
      mediaId: kind === 'comment' ? (mediaId ?? undefined) : undefined,
    });
    const next = parsed.success ? {} : toFieldErrors(parsed.error);
    if (kind === 'comment' && !mediaId) next.mediaId = t('mediaRequired');
    setErrors(next);
    if (!parsed.success || Object.keys(next).length > 0) return;
    simulate.mutate(parsed.data, {
      onSuccess: () => {
        toast.success({ title: t('done'), description: t('doneDescription') });
        setText('');
        close(false);
      },
      onError: (error) => setErrors(toFieldErrors(error)),
    });
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        title={t('title', { username: channel.username })}
        description={t('description')}
        footer={
          <>
            <Button variant="secondary" onClick={() => close(false)}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" form={formId} loading={simulate.isPending}>
              {t('submit')}
            </Button>
          </>
        }
      >
        <Form id={formId} onSubmit={submit} aria-label={t('title', { username: channel.username })}>
          <Stack gap="md">
            {simulate.error ? (
              <Callout tone="danger">{errorMessage(simulate.error)}</Callout>
            ) : null}
            <RadioGroup
              label={t('kind')}
              value={kind}
              onValueChange={(value) => setKind(value as Kind)}
            >
              <Radio value="comment" label={t('kinds.comment')} />
              <Radio value="message" label={t('kinds.message')} />
            </RadioGroup>
            <Field label={t('username')} hint={t('usernameHint')} required error={errors.username}>
              {(control) => (
                <Input
                  {...control}
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="off"
                  className="literal"
                />
              )}
            </Field>
            {kind === 'comment' ? (
              media.data && media.data.length === 0 ? (
                <Callout tone="info" variant="flat">
                  {t('mediaEmpty')}
                </Callout>
              ) : (
                <Field label={t('media')} required error={errors.mediaId}>
                  {(control) => (
                    <Select
                      {...control}
                      items={(media.data ?? []).map((item) => ({
                        value: item.id,
                        label: mediaLabel(item),
                      }))}
                      value={mediaId}
                      onValueChange={setMediaId}
                      placeholder={media.isPending ? t('mediaLoading') : t('mediaPlaceholder')}
                      disabled={media.isPending}
                    />
                  )}
                </Field>
              )
            ) : null}
            {media.error && kind === 'comment' ? (
              <Callout tone="danger">{errorMessage(media.error)}</Callout>
            ) : null}
            <Field
              label={kind === 'comment' ? t('commentText') : t('messageText')}
              required
              error={errors.text}
            >
              {(control) => (
                <Textarea
                  {...control}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  rows={3}
                  autosize
                />
              )}
            </Field>
          </Stack>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
