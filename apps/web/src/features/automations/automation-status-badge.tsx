'use client';

import type { AutomationStatus } from '@conversa/shared';
import { Badge, type BadgeTone } from '@demogar/mola-ui';
import { useTranslations } from 'next-intl';

const TONE: Record<AutomationStatus, BadgeTone> = { ACTIVE: 'success', PAUSED: 'neutral', DRAFT: 'warn' };

export function AutomationStatusBadge({ status }: { status: AutomationStatus }) {
  const t = useTranslations('automations.status');
  return (
    <Badge tone={TONE[status]} dot>
      {t(status)}
    </Badge>
  );
}
