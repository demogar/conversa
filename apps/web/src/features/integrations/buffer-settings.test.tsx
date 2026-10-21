import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockError, mockApi, renderWithProviders } from '@/test/render';
import { BufferSettings } from './buffer-settings';

const me = (role: string) => ({
  user: { id: 'u1', name: 'Ana', email: 'ana@example.com' },
  workspaces: [{ id: 'w1', name: 'Studio', role, createdAt: '2026-01-01T00:00:00.000Z' }],
});
const disconnected = {
  connected: false,
  organizationId: null,
  organizationName: null,
  lastSyncedAt: null,
  lastError: null,
};

describe('BufferSettings', () => {
  it('validates the key, sends it, and shows why Buffer refused it', async () => {
    const calls = mockApi({
      'GET /me': me('ADMIN'),
      'GET /workspaces/w1/integrations/buffer': disconnected,
      'PUT /workspaces/w1/integrations/buffer': new MockError(400, 'BUFFER_INVALID_KEY'),
    });
    renderWithProviders(<BufferSettings workspaceId="w1" />);

    const input = await screen.findByLabelText(/Buffer API key/);
    expect(input).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Connect Buffer' }));
    expect(calls.some((call) => call.method === 'PUT')).toBe(false);

    await userEvent.type(input, '  bufferkey-1234567890  ');
    await userEvent.click(screen.getByRole('button', { name: 'Connect Buffer' }));

    expect(
      await screen.findByText(
        "Buffer did not accept that API key. Copy it again from Buffer's settings.",
      ),
    ).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'PUT')?.body).toEqual({
      apiKey: 'bufferkey-1234567890',
    });
  });

  it('shows members the state without the form', async () => {
    mockApi({ 'GET /me': me('MEMBER'), 'GET /workspaces/w1/integrations/buffer': disconnected });
    renderWithProviders(<BufferSettings workspaceId="w1" />);

    expect(
      await screen.findByText('Only owners and admins can change this integration'),
    ).toBeInTheDocument();
    expect(screen.getByText('Not connected')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Buffer API key/)).not.toBeInTheDocument();
  });
});
