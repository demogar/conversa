import type { ReactNode } from 'react';
import { pageTitle } from '@/lib/metadata';

export const generateMetadata = pageTitle((t) => t('auth.signup.title'));

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
