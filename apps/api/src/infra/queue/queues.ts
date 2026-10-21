/** Webhook payloads waiting to be parsed and matched against automations. */
export const INBOUND_QUEUE = 'inbound';
/** Delivery steps waiting to be sent to a platform. */
export const OUTBOUND_QUEUE = 'outbound';
/** Recurring housekeeping: token refresh, scope resolution, cleanup. */
export const MAINTENANCE_QUEUE = 'maintenance';

export interface InboundJob {
  eventId: string;
}

export type OutboundJob =
  | { kind: 'start'; deliveryId: string }
  | { kind: 'postback'; deliveryId: string };

export const MaintenanceTask = {
  REFRESH_TOKENS: 'refresh-tokens',
  RESOLVE_SCOPES: 'resolve-scopes',
  CLEANUP: 'cleanup',
} as const;
export type MaintenanceTask = (typeof MaintenanceTask)[keyof typeof MaintenanceTask];
