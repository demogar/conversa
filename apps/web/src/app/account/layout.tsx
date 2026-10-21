import type { ReactNode } from 'react';
import { AccountFrame } from '@/features/account/account-frame';

export default function AccountLayout({ children }: { children: ReactNode }) {
  return <AccountFrame>{children}</AccountFrame>;
}
