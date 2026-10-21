import type { InstagramSetupStatusDto } from '@conversa/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockApi, renderWithProviders } from '@/test/render';
import { MetaSetupStatus } from './meta-setup-status';

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

function renderStatus(status: InstagramSetupStatusDto, onShowStep?: (step: string) => void) {
  mockApi({ 'GET /instance/instagram/status': status });
  renderWithProviders(<MetaSetupStatus onShowStep={onShowStep} />);
}

describe('MetaSetupStatus', () => {
  it('says "Never" until Meta has verified the webhook and sent an event', async () => {
    renderStatus({
      sandbox: false,
      credentials: 'valid',
      webhookVerifiedAt: null,
      lastEventAt: null,
    });
    expect(await screen.findByText('Accepted by Meta')).toBeInTheDocument();
    expect(screen.getAllByText('Never')).toHaveLength(2);
    expect(screen.getByText('Meta has not verified the webhook yet')).toBeInTheDocument();
    expect(screen.getByText(/so this is a good sign, not a guarantee/)).toBeInTheDocument();
  });

  it('shows when Meta last reached the webhooks', async () => {
    renderStatus({
      sandbox: false,
      credentials: 'valid',
      webhookVerifiedAt: minutesAgo(60),
      lastEventAt: minutesAgo(3),
    });
    expect(await screen.findByText('3 minutes ago')).toBeInTheDocument();
    expect(screen.queryByText('Never')).not.toBeInTheDocument();
    expect(screen.queryByText('No events from Instagram yet')).not.toBeInTheDocument();
  });

  it('asks about Live mode and message access when nothing arrives after verifying', async () => {
    renderStatus({
      sandbox: false,
      credentials: 'valid',
      webhookVerifiedAt: minutesAgo(20),
      lastEventAt: null,
    });
    expect(await screen.findByText('No events from Instagram yet')).toBeInTheDocument();
    expect(screen.getByText(/Is your Meta app in Live mode\?/)).toBeInTheDocument();
    // Away from /admin, the hint links to the guide step.
    expect(screen.getByRole('link', { name: 'Show step 8' })).toHaveAttribute(
      'href',
      '/admin#meta-guide-publish',
    );
    expect(screen.getByRole('link', { name: 'Show step 7' })).toHaveAttribute(
      'href',
      '/admin#meta-guide-account',
    );
  });

  it('waits a while after verifying before suggesting anything', async () => {
    renderStatus({
      sandbox: false,
      credentials: 'valid',
      webhookVerifiedAt: minutesAgo(2),
      lastEventAt: null,
    });
    expect(await screen.findByText('Accepted by Meta')).toBeInTheDocument();
    expect(screen.queryByText('No events from Instagram yet')).not.toBeInTheDocument();
  });

  it('points rejected credentials at the step that has them, in place on /admin', async () => {
    const onShowStep = jest.fn();
    renderStatus(
      { sandbox: false, credentials: 'invalid', webhookVerifiedAt: null, lastEventAt: null },
      onShowStep,
    );
    expect(await screen.findByText('Rejected by Meta')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show step 2' }));
    expect(onShowStep).toHaveBeenCalledWith('credentials');
  });

  it('has nothing to check in the sandbox', async () => {
    renderStatus({
      sandbox: true,
      credentials: 'unknown',
      webhookVerifiedAt: null,
      lastEventAt: null,
    });
    expect(await screen.findByText(/no Meta app to check/)).toBeInTheDocument();
  });
});
