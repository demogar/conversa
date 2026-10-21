import type { DashboardDto, MeDto } from '@conversa/shared';
import { screen, within } from '@testing-library/react';
import { mockApi, renderWithProviders } from '@/test/render';
import { OverviewScreen } from './overview-screen';

const me = {
  user: { id: 'u1', email: 'ana@example.com', name: 'Ana', locale: 'en', mfaEnabled: false, createdAt: '2026-01-01T00:00:00Z' },
  workspaces: [{ id: 'w1', name: 'Bakery', role: 'MEMBER', createdAt: '2026-01-01T00:00:00Z' }],
} satisfies MeDto;

const dashboard = (overrides: Partial<DashboardDto> = {}): DashboardDto => ({
  range: { from: '2026-09-21T00:00:00Z', to: '2026-10-21T00:00:00Z' },
  totals: { triggered: 1284, sent: 1200, failed: 12, clicks: 310, contacts: 640 },
  activeAutomations: 2,
  channels: 1,
  daily: [
    { date: '2026-10-20', sent: 40, failed: 1, clicks: 9 },
    { date: '2026-10-21', sent: 55, failed: 0, clicks: 12 },
  ],
  topAutomations: [{ id: 'a1', name: 'Price list', sent: 900, clicks: 200 }],
  ...overrides,
});

describe('OverviewScreen', () => {
  it('shows the totals, the top automations and no checklist once set up', async () => {
    mockApi({
      'GET /me': me,
      'GET /workspaces/w1/dashboard?days=30': dashboard(),
      'GET /workspaces/w1/automations': [{ id: 'a1' }],
    });
    renderWithProviders(<OverviewScreen workspaceId="w1" />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Bakery' })).toBeInTheDocument();
    expect(await screen.findByText('1,284')).toBeInTheDocument();
    expect(screen.getByText('2 active automations')).toBeInTheDocument();
    const top = screen.getByRole('table', { name: 'Automations with the most messages sent' });
    expect(within(top).getByRole('link', { name: 'Price list' })).toHaveAttribute('href', '/w/w1/automations/a1');
    expect(screen.queryByText('Get started')).not.toBeInTheDocument();
  });

  it('guides a new workspace, telling a member who can connect Instagram', async () => {
    mockApi({
      'GET /me': me,
      'GET /workspaces/w1/dashboard?days=30': dashboard({ channels: 0, topAutomations: [] }),
      'GET /workspaces/w1/automations': [],
    });
    renderWithProviders(<OverviewScreen workspaceId="w1" />);
    expect(await screen.findByRole('heading', { name: 'Get started' })).toBeInTheDocument();
    expect(screen.getByText(/Only an owner or an admin/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Connect Instagram' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create automation' })).toHaveAttribute('href', '/w/w1/automations/new');
  });
});
