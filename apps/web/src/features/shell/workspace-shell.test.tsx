import type { MeDto } from '@conversa/shared';
import { screen, within } from '@testing-library/react';
import { mockApi, renderWithProviders } from '@/test/render';
import { WEB_VERSION } from '@/lib/version';
import { WorkspaceShell } from './workspace-shell';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/w/w1',
}));

const me: MeDto = {
  user: {
    id: 'u1',
    email: 'ana@example.com',
    name: 'Ana',
    locale: 'en',
    mfaEnabled: false,
    isInstanceAdmin: false,
    createdAt: '2026-01-01T00:00:00Z',
  },
  workspaces: [{ id: 'w1', name: 'Acme', role: 'OWNER', createdAt: '2026-01-01T00:00:00Z' }],
};

describe('WorkspaceShell', () => {
  it('shows the running version in the sidebar footer, linked to its release notes', async () => {
    mockApi({ 'GET /me': me });
    renderWithProviders(
      <WorkspaceShell workspaceId="w1">
        <p>Page body</p>
      </WorkspaceShell>,
    );

    expect(await screen.findByText('Page body')).toBeInTheDocument();
    // The footer sits below the navigation landmark, inside the sidebar.
    const sidebar = screen.getByRole('navigation', { name: 'Main' }).parentElement!;
    const link = within(sidebar).getByRole('link', {
      name: `Conversa v${WEB_VERSION} (opens in a new tab)`,
    });
    expect(link).toHaveAttribute(
      'href',
      `https://github.com/demogar/conversa/releases/tag/v${WEB_VERSION}`,
    );
    expect(link).toHaveAttribute('target', '_blank');
  });
});
