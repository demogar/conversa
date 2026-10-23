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
  providers: { instagram: true, tiktok: false },
  sandbox: false,
  version: '0.1.0',
};

const me = (role: 'OWNER' | 'MEMBER', isInstanceAdmin = false) =>
  ({
    user: {
      id: 'u1',
      email: 'ana@example.com',
      name: 'Ana',
      locale: 'en',
      mfaEnabled: false,
      isInstanceAdmin,
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
  lastEventAt: null,
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
    expect(await screen.findByRole('heading', { name: 'No accounts yet' })).toBeInTheDocument();
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
      await screen.findByText('That account is already connected to another workspace.'),
    ).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Reconnect account' })).toBeInTheDocument();
  });

  describe('when Instagram has sent nothing', () => {
    const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
    const active = (overrides: Partial<ChannelDto> = {}): ChannelDto => ({
      ...channel,
      status: 'ACTIVE',
      connectedAt: minutesAgo(60),
      ...overrides,
    });

    function renderWith(channels: ChannelDto[], isInstanceAdmin = false) {
      mockApi({
        'GET /me': me('OWNER', isInstanceAdmin),
        'GET /instance': instance,
        'GET /workspaces/w1/channels': channels,
        'GET /instance/instagram/status': {
          sandbox: false,
          credentials: 'valid',
          webhookVerifiedAt: minutesAgo(90),
          lastEventAt: null,
        },
      });
      renderWithProviders(<ChannelsScreen workspaceId="w1" />);
    }

    it('asks an admin to check Live mode and message access, and who can fix it', async () => {
      renderWith([active()]);
      expect(await screen.findByText('No events from Instagram yet')).toBeInTheDocument();
      expect(screen.getByText(/Ask the person who set up this installation/)).toBeInTheDocument();
      expect(screen.getByText('None yet')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Open the setup guide' })).not.toBeInTheDocument();
    });

    it('links an instance admin to the guide and shows the Meta app status', async () => {
      renderWith([active()], true);
      expect(await screen.findByRole('link', { name: 'Open the setup guide' })).toHaveAttribute(
        'href',
        '/admin#meta-guide-publish',
      );
      expect(
        screen.getByText(/Is your Meta app in Live mode\?/, { selector: 'article *' }),
      ).toBeInTheDocument();
      expect(await screen.findByRole('heading', { name: 'Connection status' })).toBeInTheDocument();
      expect(await screen.findByText('Accepted by Meta')).toBeInTheDocument();
    });

    it('says nothing while the account is newly connected or once an event arrived', async () => {
      renderWith([
        active({ id: 'c1', username: 'new.one', connectedAt: minutesAgo(5) }),
        active({ id: 'c2', username: 'busy.one', lastEventAt: minutesAgo(3) }),
        active({ id: 'c3', username: 'unsubscribed', webhookSubscribed: false }),
      ]);
      expect(await screen.findByRole('heading', { name: '@busy.one' })).toBeInTheDocument();
      expect(screen.getByText('3 minutes ago')).toBeInTheDocument();
      expect(screen.queryByText('No events from Instagram yet')).not.toBeInTheDocument();
    });
  });
});

describe('ChannelsScreen with TikTok', () => {
  it('offers a connect button for each platform the installation has set up', async () => {
    mockApi({
      'GET /me': me('OWNER'),
      'GET /instance': { ...instance, providers: { instagram: true, tiktok: true } },
      'GET /workspaces/w1/channels': [],
    });
    renderWithProviders(<ChannelsScreen workspaceId="w1" />);
    expect(
      (await screen.findAllByRole('button', { name: 'Connect TikTok account' })).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('button', { name: 'Connect Instagram account' }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/TikTok accounts answer direct messages only/)).toBeInTheDocument();
  });

  it('names the platform of a TikTok channel and points its quiet hint at the TikTok setup', async () => {
    mockApi({
      'GET /me': me('OWNER', true),
      'GET /instance': { ...instance, providers: { instagram: false, tiktok: true } },
      'GET /workspaces/w1/channels': [
        {
          ...channel,
          type: 'TIKTOK',
          status: 'ACTIVE',
          displayName: 'Sol Shop',
          connectedAt: '2026-01-01T00:00:00Z',
        },
      ],
    });
    renderWithProviders(<ChannelsScreen workspaceId="w1" />);
    expect(await screen.findByText('TikTok · Sol Shop')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No events from TikTok yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the setup guide' })).toHaveAttribute(
      'href',
      '/admin#admin-tiktok',
    );
  });
});
