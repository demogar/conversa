'use client';

import { useParams } from 'next/navigation';
import { AuditLog } from '@/features/settings/audit-log';

export default function AuditLogPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  return <AuditLog workspaceId={workspaceId} />;
}
