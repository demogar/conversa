import type { InstanceDto, InstanceSettingsDto, MeDto } from '@conversa/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockError, mockApi, renderWithProviders } from '@/test/render';
import { WEB_VERSION } from '@/lib/version';
import { AdminPage } from './admin-page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/admin',
}));

const adminMe = (isInstanceAdmin = true): MeDto => ({
  user: {
    id: 'u1',
    email: 'ana@example.com',
    name: 'Ana',
    locale: 'en',
    mfaEnabled: false,
    isInstanceAdmin,
    createdAt: '2026-01-01T00:00:00Z',
  },
  workspaces: [],
});

const urls = {
  oauthRedirect: 'https://conversa.example.com/api/v1/channels/oauth/instagram/callback',
  webhook: 'https://conversa.example.com/api/v1/webhooks/instagram',
  deauthorize: 'https://conversa.example.com/api/v1/webhooks/instagram/deauthorize',
  dataDeletion: 'https://conversa.example.com/api/v1/webhooks/instagram/data-deletion',
  privacyPolicy: 'https://conversa.example.com/legal/privacy',
  termsOfService: 'https://conversa.example.com/legal/terms',
};

const settings: InstanceSettingsDto = {
  mail: {
    configured: true,
    host: 'smtp.example.com',
    port: 587,
    security: 'starttls',
    username: 'mailer@example.com',
    password: { configured: true, hint: '1234' },
    fromName: 'Conversa',
    fromAddress: 'no-reply@example.com',
  },
  instagram: {
    configured: false,
    appId: null,
    appSecret: { configured: false, hint: null },
    verifyToken: { configured: false, hint: null },
    urls,
  },
  turnstile: { configured: false, siteKey: null, secretKey: { configured: false, hint: null } },
  signup: { mode: 'invite_only' },
  sandbox: false,
};

const instance = (version = WEB_VERSION): InstanceDto => ({
  needsSetup: false,
  signupOpen: false,
  mailEnabled: true,
  captchaSiteKey: null,
  providers: { instagram: false },
  sandbox: false,
  version,
});

function routes(overrides: Record<string, unknown> = {}) {
  return mockApi({
    'GET /me': adminMe(),
    'GET /instance': instance(),
    'GET /instance/settings': settings,
    'GET /instance/instagram/status': {
      sandbox: false,
      credentials: 'not_configured',
      webhookVerifiedAt: null,
      lastEventAt: null,
    },
    'GET /instance/admins': [
      {
        id: 'u1',
        name: 'Ana',
        email: 'ana@example.com',
        isInstanceAdmin: true,
        createdAt: '2026-01-01T00:00:00Z',
      },
    ],
    ...overrides,
  });
}

describe('AdminPage', () => {
  it('shows a stored secret only as configured, and keeps it when saving', async () => {
    const calls = routes({ 'PATCH /instance/settings/mail': settings });
    renderWithProviders(<AdminPage />);

    const mail = await screen.findByRole('form', { name: 'Email' });
    expect(within(mail).getByText('Configured')).toBeInTheDocument();
    expect(within(mail).getByText('••••1234')).toBeInTheDocument();
    expect(within(mail).getByRole('button', { name: 'Replace Password' })).toBeInTheDocument();

    const port = within(mail).getByRole('textbox', { name: /Port/ });
    await userEvent.clear(port);
    await userEvent.type(port, '2525');
    await userEvent.click(within(mail).getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Email settings saved')).toBeInTheDocument();
    const saved = calls.find((call) => call.method === 'PATCH');
    expect(saved?.body).toMatchObject({ host: 'smtp.example.com', port: 2525 });
    // Left empty, so the stored password is kept.
    expect(saved?.body).not.toHaveProperty('password');
  });

  it('checks the form before saving', async () => {
    const calls = routes();
    renderWithProviders(<AdminPage />);
    const mail = await screen.findByRole('form', { name: 'Email' });

    await userEvent.clear(within(mail).getByRole('textbox', { name: /SMTP server/ }));
    await userEvent.click(within(mail).getByRole('button', { name: 'Save changes' }));

    expect(await within(mail).findByText('This is too short.')).toBeInTheDocument();
    expect(calls.some((call) => call.method === 'PATCH')).toBe(false);
  });

  it('explains why a test email failed without showing the server message', async () => {
    routes({ 'POST /instance/settings/mail/test': { ok: false, failure: 'auth' } });
    renderWithProviders(<AdminPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Send test email' }));
    expect(await screen.findByText('The test email was not sent')).toBeInTheDocument();
    expect(
      screen.getByText(
        'The mail server refused the username or password. Check them and save again.',
      ),
    ).toBeInTheDocument();
  });

  it('generates a verify token in the browser and hands it to the guide to paste into Meta', async () => {
    const calls = routes({ 'PATCH /instance/settings/instagram': settings });
    renderWithProviders(<AdminPage />);
    const instagram = await screen.findByRole('form', { name: 'Instagram app' });
    const guide = screen.getByRole('navigation', { name: 'Meta app setup steps' });

    await userEvent.type(within(instagram).getByLabelText(/Instagram app ID/), '1234567890');
    await userEvent.type(within(instagram).getByLabelText(/Instagram app secret/), 'app-secret');
    await userEvent.click(within(instagram).getByRole('button', { name: 'Generate token' }));
    const token = within(instagram).getByLabelText(/Webhook verify token/) as HTMLInputElement;
    expect(token.value).toMatch(/^[\w-]{32}$/);

    await userEvent.click(within(guide).getByRole('button', { name: '3. Connect the webhooks' }));
    expect(screen.getByText(urls.webhook)).toBeInTheDocument();
    expect(screen.getByText(token.value)).toBeInTheDocument();
    const generated = token.value;

    await userEvent.click(within(instagram).getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Instagram app saved')).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({
      appId: '1234567890',
      appSecret: 'app-secret',
      verifyToken: generated,
    });
    // Saved, so the field is empty again, but the guide still offers the token for Meta.
    expect(screen.getByText(generated)).toBeInTheDocument();

    await userEvent.click(
      within(guide).getByRole('button', { name: '4. Set up Instagram business login' }),
    );
    expect(screen.getByText(urls.oauthRedirect)).toBeInTheDocument();
  });

  it('tells a person who is not an instance admin who can change the settings', async () => {
    const calls = mockApi({ 'GET /me': adminMe(false) });
    renderWithProviders(<AdminPage />);

    expect(
      await screen.findByText('Only instance admins can change these settings'),
    ).toBeInTheDocument();
    expect(calls.some((call) => call.path === '/instance/settings')).toBe(false);
  });

  it('offers a retry when the settings do not load', async () => {
    routes({ 'GET /instance/settings': new MockError(500, 'INTERNAL') });
    renderWithProviders(<AdminPage />);
    expect(await screen.findByText('The instance settings did not load')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('shows the version of the web app and of the API, linked to their release notes', async () => {
    routes();
    renderWithProviders(<AdminPage />);

    const version = await screen.findByRole('region', { name: 'Version' });
    const name = new RegExp(`^v${WEB_VERSION.replaceAll('.', '\\.')}`);
    await waitFor(() => expect(within(version).getAllByRole('link', { name })).toHaveLength(2));
    for (const link of within(version).getAllByRole('link', { name })) {
      expect(link).toHaveAttribute(
        'href',
        `https://github.com/demogar/conversa/releases/tag/v${WEB_VERSION}`,
      );
    }
    expect(screen.queryByText('The web app and the API run different versions')).toBeNull();
  });

  it('warns when the web app and the API run different versions', async () => {
    routes({ 'GET /instance': instance('99.0.0') });
    renderWithProviders(<AdminPage />);

    expect(
      await screen.findByText('The web app and the API run different versions'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        `The web app runs v${WEB_VERSION} and the API runs v99.0.0. Update both images to the same release and restart them.`,
      ),
    ).toBeInTheDocument();
  });
});
