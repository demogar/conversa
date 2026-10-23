import type { ChannelDto, ConversationDto, MessageDto } from '@conversa/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockError, mockApi, renderWithProviders } from '@/test/render';
import { InboxScreen } from './inbox-screen';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}));

const channel: ChannelDto = {
  id: 'c1',
  type: 'INSTAGRAM',
  externalId: '178',
  username: 'tienda.sol',
  displayName: null,
  avatarUrl: null,
  status: 'ACTIVE',
  webhookSubscribed: true,
  tokenExpiresAt: null,
  connectedAt: '2026-09-01T00:00:00Z',
  lastEventAt: null,
};
const conversation: ConversationDto = {
  id: 'cv1',
  participant: { id: 'p1', username: 'marta' },
  lastMessage: 'Do you ship to Panama?',
  updatedAt: '2026-10-20T10:00:00Z',
};
const messages: MessageDto[] = [
  { id: 'm1', text: 'Do you ship to Panama?', fromSelf: false, createdAt: '2026-10-20T10:00:00Z' },
];
const base = '/workspaces/w1/channels/c1/conversations';

describe('InboxScreen', () => {
  it('sends a reply to the open conversation', async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      'GET /workspaces/w1/channels': [channel],
      [`GET ${base}`]: [conversation],
      [`GET ${base}/cv1/messages`]: messages,
      [`POST ${base}/cv1/messages/p1`]: undefined,
    });
    renderWithProviders(<InboxScreen workspaceId="w1" />);
    expect(await screen.findByRole('article', { name: /@marta/ })).toHaveTextContent(
      'Do you ship to Panama?',
    );
    await user.type(screen.getByRole('textbox', { name: /Reply to @marta/ }), 'Yes, in 3 days.');
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByText('Message sent')).toBeInTheDocument();
    expect(calls).toContainEqual({
      method: 'POST',
      path: `${base}/cv1/messages/p1`,
      body: { text: 'Yes, in 3 days.' },
    });
  });

  it('explains the reply window when the platform refuses the reply', async () => {
    const user = userEvent.setup();
    mockApi({
      'GET /workspaces/w1/channels': [channel],
      [`GET ${base}`]: [conversation],
      [`GET ${base}/cv1/messages`]: messages,
      [`POST ${base}/cv1/messages/p1`]: new MockError(422, 'MESSAGING_WINDOW_CLOSED'),
    });
    renderWithProviders(<InboxScreen workspaceId="w1" />);
    await user.type(await screen.findByRole('textbox', { name: /Reply to @marta/ }), 'Hello again');
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByText('The reply window has closed')).toBeInTheDocument();
    expect(screen.getByText(/@marta wrote too long ago/)).toBeInTheDocument();
  });

  it('points to the channels page when no account is connected', async () => {
    mockApi({ 'GET /workspaces/w1/channels': [] });
    renderWithProviders(<InboxScreen workspaceId="w1" />);
    expect(await screen.findByRole('link', { name: 'Go to channels' })).toHaveAttribute(
      'href',
      '/w/w1/channels',
    );
  });
});
