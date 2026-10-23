import type { MetaAppUrlsDto } from '@conversa/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import {
  MetaSetupGuide,
  metaGuideStartStep,
  readFurthestMetaGuideStep,
  rememberMetaGuideStep,
} from './meta-setup-guide';

const urls: MetaAppUrlsDto = {
  oauthRedirect: 'https://conversa.example.com/api/v1/channels/oauth/instagram/callback',
  webhook: 'https://conversa.example.com/api/v1/webhooks/instagram',
  deauthorize: 'https://conversa.example.com/api/v1/webhooks/instagram/deauthorize',
  dataDeletion: 'https://conversa.example.com/api/v1/webhooks/instagram/data-deletion',
  privacyPolicy: 'https://conversa.example.com/legal/privacy',
  termsOfService: 'https://conversa.example.com/legal/terms',
};

function renderGuide(verifyToken: string | null = 'verify-token-123') {
  renderWithProviders(<MetaSetupGuide urls={urls} verifyToken={verifyToken} />);
  const steps = screen.getByRole('navigation', { name: 'Meta app setup steps' });
  return {
    open: (name: string) => userEvent.click(within(steps).getByRole('button', { name })),
    current: () => within(steps).getByRole('button', { current: 'step' }),
  };
}

/** The common-mistake callout of the open step. */
const mistake = () => screen.getByRole('region', { name: 'Common mistake' });

describe('MetaSetupGuide', () => {
  it('shows one step at a time, starting with creating the app in Meta', async () => {
    const guide = renderGuide();
    expect(guide.current()).toHaveAccessibleName('1. Create the app');
    expect(screen.getByText('Step 1 of 9')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open your Meta apps/ })).toHaveAttribute(
      'href',
      'https://developers.facebook.com/apps',
    );
    expect(screen.getByText(/Meta renames them now and then/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Next step' }));
    expect(guide.current()).toHaveAccessibleName('2. Copy the Instagram app ID and secret');
    expect(mistake()).toHaveTextContent(/not the App ID at the top of the dashboard/);
    expect(mistake()).toHaveTextContent(/Facebook app ID/);

    await userEvent.click(screen.getByRole('button', { name: 'Previous step' }));
    expect(guide.current()).toHaveAccessibleName('1. Create the app');
  });

  it('gives every value to paste a copy button and the name of its Meta field', async () => {
    const guide = renderGuide();

    await guide.open('3. Connect the webhooks');
    expect(screen.getByText('Callback URL')).toBeInTheDocument();
    expect(screen.getByText(urls.webhook)).toBeInTheDocument();
    expect(screen.getByText('Verify token')).toBeInTheDocument();
    expect(screen.getByText('verify-token-123')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Copy to clipboard' })).toHaveLength(2);
    for (const field of ['comments', 'messages', 'messaging_postbacks'])
      expect(screen.getByText(field)).toBeInTheDocument();
    expect(mistake()).toHaveTextContent(
      /Save the form in Conversa before you click Verify and save/,
    );

    await guide.open('4. Set up Instagram business login');
    expect(screen.getAllByRole('button', { name: 'Copy to clipboard' })).toHaveLength(3);
    expect(screen.getByText(urls.oauthRedirect)).toBeInTheDocument();
    expect(screen.getByText(urls.deauthorize)).toBeInTheDocument();
    expect(screen.getByText(urls.dataDeletion)).toBeInTheDocument();
    expect(mistake()).toHaveTextContent(/not under Facebook Login/);

    await guide.open('5. Fill in the basic settings');
    expect(screen.getAllByRole('button', { name: 'Copy to clipboard' })).toHaveLength(3);
    expect(screen.getByText(urls.privacyPolicy)).toBeInTheDocument();
    expect(screen.getByText(urls.termsOfService)).toBeInTheDocument();
    expect(mistake()).toHaveTextContent(/1024 × 1024/);
  });

  it('warns about the mistakes that stop Instagram from working', async () => {
    const guide = renderGuide();

    await guide.open('6. Add your Instagram account as a tester');
    expect(mistake()).toHaveTextContent(/Insufficient developer role/);
    expect(screen.getByRole('link', { name: /Open Instagram tester invites/ })).toHaveAttribute(
      'href',
      'https://www.instagram.com/accounts/manage_access/',
    );

    await guide.open('7. Prepare the Instagram account');
    expect(mistake()).toHaveTextContent(/Allow access to messages/);

    await guide.open('8. Switch the app to Live');
    expect(mistake()).toHaveTextContent(/Development mode, Meta does not send real webhooks/);

    await guide.open('9. Connect the account in Conversa');
    expect(screen.queryByRole('region', { name: 'Common mistake' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next step' })).not.toBeInTheDocument();
  });

  it('explains how to get a new verify token once the saved one is no longer known', async () => {
    const guide = renderGuide(null);
    await guide.open('3. Connect the webhooks');
    expect(screen.getByText(/shown only until it is saved/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Copy to clipboard' })).toHaveLength(1);
  });
});

describe('metaGuideStartStep', () => {
  const verifiedAt = '2026-10-23T12:00:00Z';

  it('opens after the last step Conversa can see is done', () => {
    expect(metaGuideStartStep({ configured: false })).toBe('create');
    expect(metaGuideStartStep({ configured: true })).toBe('webhooks');
    expect(metaGuideStartStep({ configured: true, webhookVerifiedAt: verifiedAt })).toBe('login');
    expect(
      metaGuideStartStep({
        configured: true,
        webhookVerifiedAt: verifiedAt,
        lastEventAt: verifiedAt,
      }),
    ).toBe('connect');
  });

  it('opens at the furthest step opened, but never before what Conversa can see', () => {
    const verified = { configured: true, webhookVerifiedAt: verifiedAt };
    expect(metaGuideStartStep(verified, 'roles')).toBe('roles');
    expect(metaGuideStartStep(verified, 'credentials')).toBe('login');
    // An app removed since: only the first two steps still apply.
    expect(metaGuideStartStep({ configured: false }, 'publish')).toBe('create');
    expect(metaGuideStartStep({ configured: false }, 'credentials')).toBe('credentials');
  });

  it('remembers only the furthest step, so looking back keeps the progress', () => {
    localStorage.clear();
    rememberMetaGuideStep('roles');
    rememberMetaGuideStep('credentials');
    expect(readFurthestMetaGuideStep()).toBe('roles');
    rememberMetaGuideStep('publish');
    expect(readFurthestMetaGuideStep()).toBe('publish');
  });
});
