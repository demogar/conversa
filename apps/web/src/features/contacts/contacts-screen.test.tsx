import type { ContactDto } from '@conversa/shared';
import { screen, within } from '@testing-library/react';
import { mockApi, renderWithProviders } from '@/test/render';
import { ContactsScreen } from './contacts-screen';

const contact: ContactDto = {
  id: 'k1',
  channelId: 'c1',
  externalId: '178400001',
  username: null,
  interactions: 4,
  isFollower: null,
  firstSeenAt: '2026-09-01T12:00:00Z',
  lastInteractionAt: '2026-10-20T12:00:00Z',
};

describe('ContactsScreen', () => {
  it('shows an empty state when nobody has interacted yet', async () => {
    mockApi({
      'GET /me': { user: { id: 'u1' }, workspaces: [] },
      'GET /workspaces/w1/channels': [],
      'GET /workspaces/w1/contacts?limit=50': { items: [], nextCursor: null },
    });
    renderWithProviders(<ContactsScreen workspaceId="w1" />);
    expect(await screen.findByText('No contacts yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
  });

  it('shows a contact without a username by its Instagram id, and the count', async () => {
    mockApi({
      'GET /me': { user: { id: 'u1' }, workspaces: [] },
      'GET /workspaces/w1/channels': [],
      'GET /workspaces/w1/contacts?limit=50': { items: [contact], nextCursor: null },
    });
    renderWithProviders(<ContactsScreen workspaceId="w1" />);
    const table = await screen.findByRole('table', { name: 'Contacts' });
    expect(await within(table).findByText('178400001')).toBeInTheDocument();
    expect(within(table).getAllByText('Unknown')).toHaveLength(2);
    expect(screen.getByText('1 contact')).toBeInTheDocument();
  });
});
