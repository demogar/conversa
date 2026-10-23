import type { InstanceSettingsDto, MeDto } from '@conversa/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockApi, renderWithProviders } from '@/test/render';
import { SetupWizard } from './setup-wizard';

const replace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/admin/setup',
}));

const me: MeDto = {
  user: {
    id: 'u1',
    email: 'ana@example.com',
    name: 'Ana',
    locale: 'en',
    mfaEnabled: false,
    isInstanceAdmin: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  workspaces: [{ id: 'w1', name: 'Studio', role: 'OWNER', createdAt: '2026-01-01T00:00:00Z' }],
};

const unset = { configured: false, hint: null };
const settings: InstanceSettingsDto = {
  mail: {
    configured: false,
    host: null,
    port: null,
    security: 'starttls',
    username: null,
    password: unset,
    fromName: '',
    fromAddress: null,
  },
  instagram: {
    configured: false,
    appId: null,
    appSecret: unset,
    verifyToken: unset,
    urls: {
      oauthRedirect: 'https://conversa.example.com/api/v1/channels/oauth/instagram/callback',
      webhook: 'https://conversa.example.com/api/v1/webhooks/instagram',
      deauthorize: 'https://conversa.example.com/api/v1/webhooks/instagram/deauthorize',
      dataDeletion: 'https://conversa.example.com/api/v1/webhooks/instagram/data-deletion',
      privacyPolicy: 'https://conversa.example.com/legal/privacy',
      termsOfService: 'https://conversa.example.com/legal/terms',
    },
  },
  tiktok: {
    configured: false,
    appId: null,
    appSecret: { configured: false, hint: null },
    authorizationUrl: null,
    urls: {
      oauthRedirect: 'https://conversa.example.com/api/v1/channels/oauth/tiktok/callback/',
      webhook: 'https://conversa.example.com/api/v1/webhooks/tiktok',
    },
  },
  turnstile: { configured: false, siteKey: null, secretKey: unset },
  signup: { mode: 'invite_only' },
  sandbox: false,
};

describe('SetupWizard', () => {
  beforeEach(() => replace.mockClear());

  it('can skip every step and still reach the workspace', async () => {
    const calls = mockApi({ 'GET /me': me, 'GET /instance/settings': settings });
    renderWithProviders(<SetupWizard />);

    expect(await screen.findByRole('heading', { name: /Email/, level: 2 })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    expect(
      await screen.findByRole('heading', { name: /Instagram app/, level: 2 }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    expect(
      await screen.findByRole('heading', { name: /Human check/, level: 2 }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Skip for now' }));

    expect(await screen.findByRole('heading', { name: /Done/, level: 2 })).toBeInTheDocument();
    expect(screen.getAllByText('Not set up')).toHaveLength(3);
    await userEvent.click(screen.getByRole('button', { name: 'Go to your workspace' }));

    expect(replace).toHaveBeenCalledWith('/');
    expect(calls.some((call) => call.method !== 'GET')).toBe(false);
  });

  it('saves a step before moving on', async () => {
    const calls = mockApi({
      'GET /me': me,
      'GET /instance/settings': settings,
      'PATCH /instance/settings/mail': {
        ...settings,
        mail: { ...settings.mail, configured: true, host: 'smtp.example.com' },
      },
    });
    renderWithProviders(<SetupWizard />);

    await userEvent.type(
      await screen.findByRole('textbox', { name: /SMTP server/ }),
      'smtp.example.com',
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: /Sender address/ }),
      'no-reply@example.com',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));

    expect(
      await screen.findByRole('heading', { name: /Instagram app/, level: 2 }),
    ).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'PATCH')?.body).toMatchObject({
      host: 'smtp.example.com',
      port: 587,
      security: 'starttls',
      fromAddress: 'no-reply@example.com',
    });
  });

  it('guides through the Meta app and saves it without leaving the step', async () => {
    const calls = mockApi({
      'GET /me': me,
      'GET /instance/settings': settings,
      'PATCH /instance/settings/instagram': settings,
    });
    renderWithProviders(<SetupWizard />);
    await userEvent.click(await screen.findByRole('button', { name: 'Skip for now' }));
    expect(
      await screen.findByRole('navigation', { name: 'Meta app setup steps' }),
    ).toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox', { name: /Instagram app ID/ }), '1234567890');
    await userEvent.type(screen.getByLabelText(/Instagram app secret/), 'app-secret');
    await userEvent.click(screen.getByRole('button', { name: 'Generate token' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save Instagram app' }));

    expect(await screen.findByText('Instagram app saved')).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'PATCH')?.body).toMatchObject({
      appId: '1234567890',
    });
    // Still on the Instagram step, so the rest of the guide is at hand.
    expect(screen.getByRole('navigation', { name: 'Meta app setup steps' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /Site key/ })).not.toBeInTheDocument();
  });
});
