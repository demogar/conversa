import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockApi, renderWithProviders } from '@/test/render';
import { MfaSection } from './mfa-section';

describe('MfaSection', () => {
  it('walks through setup and shows the recovery codes once', async () => {
    const calls = mockApi({
      'POST /me/mfa/setup': {
        secret: 'JBSWY3DPEHPK3PXP',
        otpauthUrl: 'otpauth://totp/x',
        qrSvg: '<svg></svg>',
      },
      'POST /me/mfa/enable': { recoveryCodes: ['aaaa-bbbb', 'cccc-dddd'] },
    });
    renderWithProviders(<MfaSection enabled={false} />);

    await userEvent.click(screen.getByRole('button', { name: 'Set up two-step verification' }));
    expect(await screen.findByRole('img', { name: /QR code/ })).toBeInTheDocument();
    expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument();

    const code = screen.getByRole('textbox', { name: /Six-digit code/ });
    await userEvent.type(code, '12');
    await userEvent.click(screen.getByRole('button', { name: 'Turn on two-step verification' }));
    expect(
      await screen.findByText('Enter the six digits from your authenticator app.'),
    ).toBeInTheDocument();
    expect(calls.some((call) => call.path === '/me/mfa/enable')).toBe(false);

    await userEvent.type(code, '3456');
    await userEvent.click(screen.getByRole('button', { name: 'Turn on two-step verification' }));

    expect(await screen.findByText('Save your recovery codes')).toBeInTheDocument();
    expect(screen.getByText(/aaaa-bbbb/)).toBeInTheDocument();
    expect(calls.find((call) => call.path === '/me/mfa/enable')?.body).toEqual({ code: '123456' });

    await userEvent.click(screen.getByRole('button', { name: 'I have saved my codes' }));
    expect(screen.queryByText(/aaaa-bbbb/)).not.toBeInTheDocument();
  });
});
