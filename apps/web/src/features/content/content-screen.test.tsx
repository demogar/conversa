import { screen, within } from '@testing-library/react';
import { mockApi, renderWithProviders } from '@/test/render';
import { ContentScreen } from './content-screen';

const me = {
  user: { id: 'u1', name: 'Ana', email: 'ana@example.com' },
  workspaces: [{ id: 'w1', name: 'Studio', role: 'OWNER', createdAt: '2026-01-01T00:00:00.000Z' }],
};
const base = '/workspaces/w1/integrations/buffer';
const post = (id: string, automationIds: string[]) => ({
  id,
  channelId: 'b-ch',
  text: `Caption of ${id}`,
  status: 'scheduled',
  dueAt: '2030-05-01T15:00:00.000Z',
  sentAt: null,
  externalLink: null,
  thumbnailUrl: null,
  automationIds,
});

describe('ContentScreen', () => {
  it('offers an automation for a scheduled post and links the one already waiting', async () => {
    mockApi({
      'GET /me': me,
      [`GET ${base}`]: {
        connected: true,
        organizationId: 'o1',
        organizationName: 'Org',
        lastSyncedAt: null,
        lastError: null,
      },
      [`GET ${base}/channels`]: [
        { id: 'b-ch', name: 'studio', service: 'instagram', avatar: null, linkedChannelId: 'c1' },
      ],
      [`GET ${base}/posts?view=scheduled`]: [post('p1', []), post('p2', ['a9'])],
    });
    renderWithProviders(<ContentScreen workspaceId="w1" />);

    const list = await screen.findByRole('list', { name: 'Scheduled posts' });
    const [first, second] = within(list).getAllByRole('article');
    expect(within(first!).getByText('Caption of p1')).toBeInTheDocument();
    expect(
      within(first!).getByRole('link', { name: 'Create automation for this post' }),
    ).toHaveAttribute('href', '/w/w1/automations/new?bufferPostId=p1&channelId=c1');
    expect(within(second!).getByText('Automation waiting')).toBeInTheDocument();
    expect(within(second!).getByRole('link', { name: 'Open automation' })).toHaveAttribute(
      'href',
      '/w/w1/automations/a9',
    );
  });

  it('explains the feature when Buffer is not connected', async () => {
    mockApi({
      'GET /me': me,
      [`GET ${base}`]: {
        connected: false,
        organizationId: null,
        organizationName: null,
        lastSyncedAt: null,
        lastError: null,
      },
    });
    renderWithProviders(<ContentScreen workspaceId="w1" />);

    expect(await screen.findByText('Connect Buffer to see your posts here')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open integrations' })).toHaveAttribute(
      'href',
      '/w/w1/settings/integrations',
    );
  });
});
