'use client';

import { useSyncExternalStore } from 'react';

export type Theme = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'conversa-theme';
const listeners = new Set<() => void>();

function storedTheme(): Theme {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function choose(next: Theme): void {
  const root = document.documentElement;
  if (next === 'system') delete root.dataset.theme;
  else root.dataset.theme = next;
  try {
    if (next === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Storage can be blocked; the attribute still applies to this page.
  }
  for (const listener of listeners) listener();
}

/**
 * The theme choice, stored per browser; "system" follows the operating
 * system. The server always renders "system", the browser then reads the
 * stored choice, so hydration never mismatches.
 */
export function useTheme(): [Theme, (theme: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, storedTheme, () => 'system' as const);
  return [theme, choose];
}
