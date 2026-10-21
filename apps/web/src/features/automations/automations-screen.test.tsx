import type { AutomationDto, ChannelDto } from '@conversa/shared';
import { screen } from '@testing-library/react';
import { mockApi, renderWithProviders } from '@/test/render';
import { AutomationsScreen } from './automations-screen';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/w/w1/automations',
}));

const channel: ChannelDto = {
  id: 'c1',
  type: 'INSTAGRAM',
  externalId: 'ig1',
  username: 'tienda',
  displayName: 'Tienda',
  avatarUrl: null,
  status: 'ACTIVE',
  webhookSubscribed: true,
  tokenExpiresAt: null,
  connectedAt: '2026-01-01T00:00:00Z',
};

const automation: AutomationDto = {
  id: 'a1',
  name: 'Price list',
  status: 'PAUSED',
  channelId: 'c1',
  triggerType: 'COMMENT',
  postScope: 'ANY',
  mediaIds: [],
  bufferPostId: null,
  matchMode: 'KEYWORDS',
  keywords: ['price', 'cost', 'info'],
  wholeWord: true,
  oncePerContact: true,
  response: {
    publicReply: { enabled: false, variants: [] },
    message: { text: 'Here you go', buttons: [] },
    opening: { enabled: false, text: '', buttonLabel: '' },
    followGate: { enabled: false, text: '', buttonLabel: '' },
  },
  stats: { triggered: 1204, sent: 1180, failed: 24, clicks: 512 },
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('AutomationsScreen', () => {
  it('lists automations with their trigger, account, status and figures', async () => {
    mockApi({ 'GET /workspaces/w1/automations': [automation], 'GET /workspaces/w1/channels': [channel] });
    renderWithProviders(<AutomationsScreen workspaceId="w1" />);

    expect(await screen.findByRole('link', { name: 'Price list' })).toHaveAttribute('href', '/w/w1/automations/a1');
    expect(screen.getByText('Comment · 3 keywords')).toBeInTheDocument();
    expect(await screen.findByText('@tienda')).toBeInTheDocument();
    expect(screen.getByText('Paused')).toBeInTheDocument();
    expect(screen.getByText('1,204')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actions for Price list' })).toBeInTheDocument();
  });

  it('explains automations and offers to create the first one', async () => {
    mockApi({ 'GET /workspaces/w1/automations': [], 'GET /workspaces/w1/channels': [channel] });
    renderWithProviders(<AutomationsScreen workspaceId="w1" />);

    expect(await screen.findByRole('heading', { name: 'No automations yet' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Create automation' })[0]).toHaveAttribute('href', '/w/w1/automations/new');
  });

  it('sends people to Channels when no account is connected yet', async () => {
    mockApi({ 'GET /workspaces/w1/automations': [], 'GET /workspaces/w1/channels': [] });
    renderWithProviders(<AutomationsScreen workspaceId="w1" />);

    expect(await screen.findByRole('heading', { name: 'Connect an Instagram account first' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to channels' })).toHaveAttribute('href', '/w/w1/channels');
    expect(screen.queryByRole('link', { name: 'Create automation' })).not.toBeInTheDocument();
  });
});
