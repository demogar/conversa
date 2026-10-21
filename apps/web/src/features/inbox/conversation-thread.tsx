'use client';

import {
  Button,
  Callout,
  EmptyState,
  Field,
  Form,
  Message,
  SkeletonGroup,
  SkeletonText,
  Textarea,
  Thread,
  useToast,
} from '@demogar/mola-ui';
import { type ConversationDto, sendInboxMessageSchema } from '@conversa/shared';
import { RotateCcw, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { ApiError } from '@/lib/api/client';
import { useMessages, useSendMessage } from '@/lib/api/hooks/inbox';
import { type FieldErrors, useErrorMessage, useFieldErrors } from '@/lib/errors';

export function contactName(conversation: ConversationDto, fallback: string): string {
  return conversation.participant.username ? `@${conversation.participant.username}` : fallback;
}

/** One conversation: the messages, oldest first, and a composer under them. */
export function ConversationThread({
  workspaceId,
  channelId,
  conversation,
}: {
  workspaceId: string;
  channelId: string;
  conversation: ConversationDto;
}) {
  const t = useTranslations('inbox');
  const tCommon = useTranslations('common.actions');
  const messages = useMessages(workspaceId, channelId, conversation.id);
  const name = contactName(conversation, t('unknownContact'));
  const label = t('thread', { name });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {messages.isPending ? (
        <SkeletonGroup
          loading
          label={t('states.loadingMessages')}
          fallback={
            <div className="flex flex-col gap-6 py-4">
              <SkeletonText lines={2} />
              <SkeletonText lines={3} />
              <SkeletonText lines={1} />
            </div>
          }
        />
      ) : messages.isError ? (
        <EmptyState
          kind="error"
          size="sm"
          headingLevel={3}
          title={t('states.messagesFailed')}
          description={t('states.loadFailedDescription')}
          actions={
            <Button
              variant="secondary"
              size="sm"
              icon={<RotateCcw />}
              onClick={() => messages.refetch()}
            >
              {tCommon('retry')}
            </Button>
          }
        />
      ) : messages.data.length === 0 ? (
        <p className="m-0 py-4 text-sm text-ink-muted">{t('noMessages')}</p>
      ) : (
        <Thread
          label={label}
          messages={{ jumpToLatest: t('jumpToLatest'), transcript: t.raw('transcript') as string }}
          className="min-h-0 flex-1"
        >
          {messages.data.map((message) => (
            <Message
              key={message.id}
              role={message.fromSelf ? 'assistant' : 'user'}
              author={message.fromSelf ? t('you') : name}
              timestamp={message.createdAt ?? undefined}
            >
              {message.text ? (
                <p className="m-0 whitespace-pre-wrap break-words">{message.text}</p>
              ) : (
                <p className="m-0 text-sm text-ink-muted">{t('noText')}</p>
              )}
            </Message>
          ))}
        </Thread>
      )}
      <Composer
        // A fresh composer per conversation, so a draft never follows you to another person.
        key={conversation.id}
        workspaceId={workspaceId}
        channelId={channelId}
        conversation={conversation}
        name={name}
      />
    </div>
  );
}

function Composer({
  workspaceId,
  channelId,
  conversation,
  name,
}: {
  workspaceId: string;
  channelId: string;
  conversation: ConversationDto;
  name: string;
}) {
  const t = useTranslations('inbox.composer');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const toFieldErrors = useFieldErrors();
  const send = useSendMessage(workspaceId, channelId, conversation.id, conversation.participant.id);
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = sendInboxMessageSchema.safeParse({ text });
    setErrors(parsed.success ? {} : toFieldErrors(parsed.error));
    if (!parsed.success) return;
    send.mutate(parsed.data.text, {
      onSuccess: () => {
        setText('');
        toast.success({ title: t('sent') });
      },
      onError: (error) => setErrors(toFieldErrors(error)),
    });
  }

  const windowClosed =
    send.error instanceof ApiError && send.error.code === 'MESSAGING_WINDOW_CLOSED';

  return (
    <Form
      onSubmit={submit}
      aria-label={t('label', { name })}
      className="border-t border-keyline pt-4"
    >
      <div className="flex flex-col gap-3">
        {windowClosed ? (
          <Callout tone="warn" title={t('windowClosedTitle')}>
            {t('windowClosed', { name })}
          </Callout>
        ) : send.error ? (
          <Callout tone="danger">{errorMessage(send.error)}</Callout>
        ) : null}
        <Field label={t('label', { name })} hint={t('hint')} required error={errors.text}>
          {(control) => (
            <Textarea
              {...control}
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={2}
              autosize
              className="max-h-48"
            />
          )}
        </Field>
        <Button type="submit" icon={<Send />} loading={send.isPending} className="self-end">
          {t('submit')}
        </Button>
      </div>
    </Form>
  );
}
