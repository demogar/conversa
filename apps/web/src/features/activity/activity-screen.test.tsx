import type { DeliveryDto } from '@conversa/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockApi, renderWithProviders } from '@/test/render';
import { ActivityScreen } from './activity-screen';

const delivery = (id: string, overrides: Partial<DeliveryDto> = {}): DeliveryDto => ({
  id,
  automationId: 'a1',
  automationName: 'Price list',
  channelId: 'c1',
  contact: { id: `p-${id}`, username: `fan_${id}` },
  triggerText: 'How much is it?',
  matchedKeyword: 'price',
  status: 'SENT',
  skipReason: null,
  errorCode: null,
  publicReplySent: true,
  attempts: 1,
  createdAt: '2026-10-20T10:00:00Z',
  sentAt: '2026-10-20T10:00:02Z',
  ...overrides,
});

describe('ActivityScreen', () => {
  it('shows each status in words, explains failures and loads the next page', async () => {
    const calls = mockApi({
      'GET /workspaces/w1/automations': [],
      'GET /workspaces/w1/activity?limit=50': {
        items: [
          delivery('d1'),
          delivery('d2', {
            status: 'FAILED',
            errorCode: 'WINDOW_CLOSED',
            publicReplySent: false,
            attempts: 3,
          }),
          delivery('d3', {
            status: 'SKIPPED',
            skipReason: 'AUTOMATION_PAUSED',
            contact: { id: 'p3', username: null },
          }),
        ],
        nextCursor: 'd3',
      },
      'GET /workspaces/w1/activity?cursor=d3&limit=50': {
        items: [delivery('d4', { status: 'AWAITING_FOLLOW' })],
        nextCursor: null,
      },
    });
    renderWithProviders(<ActivityScreen workspaceId="w1" />);

    const table = await screen.findByRole('table', { name: 'Automation activity' });
    expect(await within(table).findByText('@fan_d1')).toBeInTheDocument();
    expect(
      within(table).getByText('Sent', { selector: '[data-slot="badge"]' }),
    ).toBeInTheDocument();
    expect(within(table).getByText('Failed')).toBeInTheDocument();
    expect(within(table).getByText(/24 hours in which Instagram allows/)).toBeInTheDocument();
    expect(within(table).getByText('WINDOW_CLOSED')).toBeInTheDocument();
    expect(within(table).getByText(/paused before the message went out/)).toBeInTheDocument();
    expect(within(table).getByText('Unknown')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(await within(table).findByText('Waiting for a follow')).toBeInTheDocument();
    expect(calls.map((call) => call.path)).toContain('/workspaces/w1/activity');
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
  });

  it('says nothing has happened yet when the log is empty', async () => {
    mockApi({
      'GET /workspaces/w1/automations': [],
      'GET /workspaces/w1/activity?limit=50': { items: [], nextCursor: null },
    });
    renderWithProviders(<ActivityScreen workspaceId="w1" />);
    expect(await screen.findByText('No activity yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create automation' })).toHaveAttribute(
      'href',
      '/w/w1/automations/new',
    );
  });
});
