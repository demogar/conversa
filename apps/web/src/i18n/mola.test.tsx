import { defaultMessages, MessagesProvider, ToastProvider } from '@demogar/mola-ui';
import { render, screen } from '@testing-library/react';
import { molaSpanish } from './mola-es';

function keys(tree: unknown, prefix = ''): string[] {
  if (tree && typeof tree === 'object') {
    return Object.entries(tree).flatMap(([key, value]) =>
      keys(value, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [prefix];
}

describe('molaSpanish', () => {
  it('translates every word the design system renders itself', () => {
    expect(keys(molaSpanish).sort()).toEqual(keys(defaultMessages).sort());
  });

  it('names the notifications region in Spanish', () => {
    render(
      <MessagesProvider messages={molaSpanish}>
        <ToastProvider>
          <p>Contenido</p>
        </ToastProvider>
      </MessagesProvider>,
    );
    expect(screen.getByRole('region', { name: 'Notificaciones' })).toBeInTheDocument();
  });
});
