import type { ChannelDto, InstanceDto, MeDto } from '@conversa/shared';
import { screen } from '@testing-library/react';
import { mockApi, renderWithProviders } from '@/test/render';
import { ChannelsScreen } from './channels-screen';

const replace = jest.fn();
let search = new URLSearchParams();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: jest.fn() }),
  usePathname: () => '/w/w1/channels',
  useSearchParams: () => search,
}));

const instance: InstanceDto = {
  needsSetup: false,
  signupOpen: false,
  mailEnabled: false,
  captchaSiteKey: null,
  providers: { instagram: true },
  sandbox: false,
};

const me = (role: 'OWNER' | 'MEMBER') =>
  ({
    user: {
      id: 'u1',
      email: 'ana@example.com',
      name: 'Ana',
      locale: 'en',
      mfaEnabled: false,
      createdAt: '2026-01-01T00:00:00Z',
    },
    workspaces: [{ id: 'w1', name: 'Shop', role, createdAt: '2026-01-01T00:00:00Z' }],
  }) as unknown as MeDto;

const channel: ChannelDto = {
  id: 'c1',
  type: 'INSTAGRAM',
  externalId: '178',
  username: 'tienda.sol',
  displayName: 'Tienda Sol',
  avatarUrl: null,
  status: 'NEEDS_REAUTH',
  webhookSubscribed: true,
  tokenExpiresAt: null,
  connectedAt: '2026-09-01T00:00:00Z',
};

beforeEach(() => {
  replace.mockReset();
  search = new URLSearchParams();
});

describe('ChannelsScreen', () => {
  it('shows the first-run empty state with its requirements to an owner', async () => {
    mockApi({
      'GET /me': me('OWNER'),
      'GET /instance': instance,
      'GET /workspaces/w1/channels': [],
    });
    renderWithProviders(<ChannelsScreen workspaceId="w1" />);
    expect(
      await screen.findByRole('heading', { name: 'No Instagram accounts yet' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/professional account \(Business or Creator\)/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Connect Instagram account' })).toHaveLength(2);
  });

  it('lists accounts for a member with no controls and says who can change them', async () => {
    mockApi({
      'GET /me': me('MEMBER'),
      'GET /instance': instance,
      'GET /workspaces/w1/channels': [channel],
    });
    renderWithProviders(<ChannelsScreen workspaceId="w1" />);
    expect(await screen.findByRole('heading', { name: '@tienda.sol' })).toBeInTheDocument();
    expect(screen.getByText('Needs reconnecting')).toBeInTheDocument();
    expect(await screen.findByText(/Only workspace owners and admins/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Connect Instagram account' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reconnect account' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Disconnect account' })).not.toBeInTheDocument();
  });

  it('translates the error the connection callback sent back', async () => {
    search = new URLSearchParams('error=CHANNEL_IN_OTHER_WORKSPACE');
    mockApi({
      'GET /me': me('OWNER'),
      'GET /instance': instance,
      'GET /workspaces/w1/channels': [channel],
    });
    renderWithProviders(<ChannelsScreen workspaceId="w1" />);
    expect(
      await screen.findByText('That Instagram account is already connected to another workspace.'),
    ).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Reconnect account' })).toBeInTheDocument();
  });
});
