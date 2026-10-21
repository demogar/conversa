import type { CreatedInvitationDto, MeDto, MemberDto, WorkspaceRole } from '@conversa/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockApi, renderWithProviders } from '@/test/render';
import { MembersSettings } from './members-settings';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/w/w1/settings/members',
}));

const me = (role: WorkspaceRole): MeDto => ({
  user: {
    id: 'u1',
    email: 'ana@example.com',
    name: 'Ana',
    locale: 'en',
    mfaEnabled: false,
    isInstanceAdmin: false,
    createdAt: '2026-01-01T00:00:00Z',
  },
  workspaces: [{ id: 'w1', name: 'Studio', role, createdAt: '2026-01-01T00:00:00Z' }],
});

const members: MemberDto[] = [
  {
    userId: 'u1',
    name: 'Ana',
    email: 'ana@example.com',
    role: 'OWNER',
    joinedAt: '2026-01-01T00:00:00Z',
  },
  {
    userId: 'u2',
    name: 'Beto',
    email: 'beto@example.com',
    role: 'MEMBER',
    joinedAt: '2026-01-02T00:00:00Z',
  },
];

const created: CreatedInvitationDto = {
  id: 'i1',
  email: 'carla@example.com',
  role: 'MEMBER',
  expiresAt: '2026-01-08T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
  invitedBy: 'Ana',
  acceptUrl: 'http://localhost:3000/invite/abcdefghijklmnopqrstuvwxyz',
  emailed: false,
};

describe('MembersSettings', () => {
  it('hides role changes and invitations from members', async () => {
    mockApi({ 'GET /me': me('MEMBER'), 'GET /workspaces/w1/members': members });
    renderWithProviders(<MembersSettings workspaceId="w1" />);

    expect(await screen.findByText('beto@example.com')).toBeInTheDocument();
    expect(
      screen.getByText('Only owners and admins can invite people and change roles'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Role of Beto' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove Beto' })).not.toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Invite someone' })).not.toBeInTheDocument();
  });

  it('lets an owner change roles and shows a copyable link when the invitation was not emailed', async () => {
    const calls = mockApi({
      'GET /me': me('OWNER'),
      'GET /workspaces/w1/members': members,
      'GET /workspaces/w1/invitations': [],
      'POST /workspaces/w1/invitations': created,
    });
    renderWithProviders(<MembersSettings workspaceId="w1" />);

    expect(await screen.findByRole('combobox', { name: 'Role of Beto' })).toBeInTheDocument();
    // Your own row offers Leave, never a role change.
    expect(screen.queryByRole('combobox', { name: 'Role of Ana' })).not.toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox', { name: /Email/ }), 'carla@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send invitation' }));

    expect(await screen.findByText('Share this invitation link')).toBeInTheDocument();
    expect(screen.getByText(created.acceptUrl)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy/ })).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      email: 'carla@example.com',
      role: 'MEMBER',
    });
  });
});
