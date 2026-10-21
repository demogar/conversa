import type { ReactNode } from 'react';
import { AccountFrame } from '@/features/account/account-frame';

/** Like the account page, the admin area lives outside any workspace. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AccountFrame>{children}</AccountFrame>;
}
