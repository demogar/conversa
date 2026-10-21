import type { ChannelDto } from '@conversa/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockApi, renderWithProviders } from '@/test/render';
import { NewAutomationScreen } from './automation-builder';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: jest.fn() }),
  usePathname: () => '/w/w1/automations/new',
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

describe('NewAutomationScreen', () => {
  beforeEach(() => push.mockReset());

  it('asks for keywords before saving, then posts the automation and goes back to the list', async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      'GET /workspaces/w1/channels': [channel],
      'POST /workspaces/w1/automations': (body: unknown) => ({ id: 'a1', ...(body as object) }),
    });
    renderWithProviders(<NewAutomationScreen workspaceId="w1" />);

    await user.type(await screen.findByRole('textbox', { name: /^Name/ }), 'Price list');
    await user.type(screen.getByRole('textbox', { name: /^Direct message/ }), 'Hi {{username}, here are the prices');
    await user.click(screen.getByRole('button', { name: 'Save and activate' }));

    expect(await screen.findByRole('region', { name: /1 field needs fixing/ })).toBeInTheDocument();
    expect(
      screen.getAllByText('Add at least one keyword, or choose to reply to every comment.').length,
    ).toBeGreaterThan(0);
    expect(calls.some((call) => call.method === 'POST')).toBe(false);

    await user.type(screen.getByRole('textbox', { name: /^Add a keyword/ }), 'precio{Enter}');
    expect(within(screen.getByRole('grid', { name: 'Keywords' })).getByText('precio')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save and activate' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/w/w1/automations'));
    const post = calls.find((call) => call.method === 'POST');
    expect(post?.body).toMatchObject({
      name: 'Price list',
      channelId: 'c1',
      status: 'ACTIVE',
      triggerType: 'COMMENT',
      postScope: 'ANY',
      matchMode: 'KEYWORDS',
      keywords: ['precio'],
      response: { message: { text: 'Hi {username}, here are the prices', buttons: [] } },
    });
  });

  it('shows whether a test comment would match the keywords', async () => {
    const user = userEvent.setup();
    mockApi({ 'GET /workspaces/w1/channels': [channel] });
    renderWithProviders(<NewAutomationScreen workspaceId="w1" />);

    await user.type(await screen.findByRole('textbox', { name: /^Add a keyword/ }), 'precio{Enter}');
    const tester = screen.getByRole('textbox', { name: /^Test a comment/ });
    await user.type(tester, '¿Cuál es el PRECIO?');
    expect(screen.getByText('Matches “precio”')).toBeInTheDocument();

    await user.clear(tester);
    await user.type(tester, 'precios');
    expect(screen.getByText('No match')).toBeInTheDocument();
  });

  it('points to Channels when no account is connected', async () => {
    mockApi({ 'GET /workspaces/w1/channels': [] });
    renderWithProviders(<NewAutomationScreen workspaceId="w1" />);
    expect(await screen.findByRole('link', { name: 'Go to channels' })).toHaveAttribute('href', '/w/w1/channels');
  });
});
