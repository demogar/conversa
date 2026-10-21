'use client';

import {
  Badge,
  Heading,
  LinkButton,
  Panel,
  StepList,
  type StepListItem,
  Text,
} from '@demogar/mola-ui';
import { AtSign, Plus } from 'lucide-react';
import NextLink from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { workspacePath } from '@/lib/navigation';

interface GettingStartedProps {
  workspaceId: string;
  hasChannel: boolean;
  hasAutomation: boolean;
  /** Only owners and admins may connect a channel; members are told who can. */
  canConnect: boolean;
}

/** The first-run checklist: connect an account, then create an automation. */
export function GettingStarted({
  workspaceId,
  hasChannel,
  hasAutomation,
  canConnect,
}: GettingStartedProps) {
  const t = useTranslations('dashboard.gettingStarted');

  const state = (done: boolean) =>
    done ? (
      <Badge tone="success" dot>
        {t('done')}
      </Badge>
    ) : (
      <Badge tone="neutral" dot>
        {t('todo')}
      </Badge>
    );

  const note = (text: string, action: ReactNode) => (
    <span className="flex flex-col items-start gap-2">
      <span>{text}</span>
      {action}
    </span>
  );

  const items: StepListItem[] = [
    {
      id: 'connect',
      label: state(hasChannel),
      title: t('connect.title'),
      note: note(
        t('connect.note'),
        hasChannel ? null : canConnect ? (
          <LinkButton
            size="sm"
            icon={<AtSign />}
            render={<NextLink href={workspacePath(workspaceId, '/channels')} />}
          >
            {t('connect.action')}
          </LinkButton>
        ) : (
          <span className="text-ink-muted">{t('connect.memberNote')}</span>
        ),
      ),
    },
    {
      id: 'automate',
      label: state(hasAutomation),
      title: t('automate.title'),
      note: note(
        t('automate.note'),
        hasAutomation ? null : (
          <LinkButton
            size="sm"
            variant={hasChannel ? 'primary' : 'secondary'}
            icon={<Plus />}
            render={<NextLink href={workspacePath(workspaceId, '/automations/new')} />}
          >
            {t('automate.action')}
          </LinkButton>
        ),
      ),
    },
  ];

  return (
    <Panel as="section" edge="band" aria-labelledby="getting-started-title">
      <div className="flex flex-col gap-3">
        <div>
          <Heading level={2} visualLevel={3} id="getting-started-title">
            {t('title')}
          </Heading>
          <Text variant="secondary">{t('description')}</Text>
        </div>
        <StepList items={items} aria-label={t('label')} />
      </div>
    </Panel>
  );
}
