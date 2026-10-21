import type { ReactNode } from 'react';
import { VersionLink } from '@/features/brand/version-link';
import { PreferencesBar } from '@/features/preferences/preferences-bar';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-cloth px-4 py-10">
      <div className="flex w-full max-w-md flex-col gap-6">
        {children}
        <PreferencesBar />
        <footer className="flex justify-center">
          <VersionLink />
        </footer>
      </div>
    </main>
  );
}
