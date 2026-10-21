'use client';

import { Badge, type BadgeTone } from '@demogar/mola-ui';
import type { DeliveryDto, DeliveryStatus } from '@conversa/shared';
import { useTranslations } from 'next-intl';

const STATUS_TONE: Record<DeliveryStatus, BadgeTone> = {
  SENT: 'success',
  FAILED: 'danger',
  SKIPPED: 'neutral',
  AWAITING_TAP: 'info',
  AWAITING_FOLLOW: 'info',
  PENDING: 'neutral',
};

export function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  const t = useTranslations('activity.status');
  return (
    <Badge tone={STATUS_TONE[status]} dot>
      {t(status)}
    </Badge>
  );
}

const SKIP_REASONS = [
  'RATE_LIMITED',
  'CHANNEL_INACTIVE',
  'AUTOMATION_PAUSED',
  'ALREADY_REPLIED',
] as const;
const ERROR_CODES = [
  'AUTH',
  'RATE_LIMIT',
  'WINDOW_CLOSED',
  'REJECTED',
  'TRANSIENT',
  'INTERNAL',
] as const;

const isOneOf = <T extends string>(list: readonly T[], value: string): value is T =>
  (list as readonly string[]).includes(value);

/** Why a delivery was skipped or failed, as a sentence; null when it went fine. */
export function useDeliveryExplanation(): (delivery: DeliveryDto) => string | null {
  const t = useTranslations('activity');
  return (delivery) => {
    if (delivery.status === 'SKIPPED') {
      const reason = delivery.skipReason ?? '';
      return isOneOf(SKIP_REASONS, reason) ? t(`skip.${reason}`) : t('skip.unknown');
    }
    if (delivery.status === 'FAILED') {
      const code = delivery.errorCode ?? '';
      return isOneOf(ERROR_CODES, code) ? t(`errorCodes.${code}`) : t('errorCodes.unknown');
    }
    return null;
  };
}
