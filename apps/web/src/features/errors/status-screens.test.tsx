import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { NotFoundScreen, RouteErrorScreen } from './status-screens';

describe('NotFoundScreen', () => {
  it('names the page and offers the way back in', () => {
    renderWithProviders(<NotFoundScreen />);
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'This page does not exist' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to your workspace' })).toHaveAttribute('href', '/');
  });
});

describe('RouteErrorScreen', () => {
  it('shows the reference of a server error, never its message, and retries', async () => {
    const retry = jest.fn();
    const error = Object.assign(new Error('secret detail'), { digest: 'abc123' });
    renderWithProviders(<RouteErrorScreen error={error} retry={retry} />);

    expect(
      screen.getByRole('heading', { name: 'Something went wrong on this page' }),
    ).toBeVisible();
    expect(screen.getByText('abc123')).toBeInTheDocument();
    expect(screen.queryByText(/secret detail/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Go to your workspace' })).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('links home when it stands alone', () => {
    renderWithProviders(<RouteErrorScreen error="boom" retry={() => {}} standalone />);
    expect(screen.getByRole('link', { name: 'Go to your workspace' })).toHaveAttribute('href', '/');
  });
});
