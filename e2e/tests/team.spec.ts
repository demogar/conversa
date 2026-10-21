import { expect, test } from '@playwright/test';
import { openWorkspace } from '../support/app';

const member = {
  name: 'Mateo Member',
  email: 'member@example.com',
  password: 'a long and memorable member passphrase',
};

test('an invited member joins and only sees what members may do', async ({
  page,
  browser,
  baseURL,
}) => {
  const workspaceId = await openWorkspace(page);
  let acceptUrl = '';

  await test.step('the owner invites a member and gets the link to share', async () => {
    await page.goto(`/w/${workspaceId}/settings/members`);
    await expect(page.getByRole('heading', { name: 'Members' }).first()).toBeVisible();
    const form = page.getByRole('form', { name: 'Invite someone' });
    await form.getByLabel('Email').fill(member.email);
    await form.getByRole('combobox', { name: 'Role' }).click();
    await page.getByRole('option', { name: 'Member' }).click();
    await form.getByRole('button', { name: 'Send invitation' }).click();

    // No mail server in this stack, so the link is shown instead of sent.
    await expect(page.getByText('Share this invitation link')).toBeVisible();
    acceptUrl = (await page.locator('pre').filter({ hasText: '/invite/' }).innerText()).trim();
    expect(acceptUrl).toMatch(new RegExp(`^${baseURL}/invite/[^/\\s]+$`));
  });

  const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  const invited = await context.newPage();

  await test.step('the invited person creates an account from the link', async () => {
    await invited.goto(acceptUrl);
    await expect(invited.getByText('You were invited to join')).toBeVisible();
    await invited.getByRole('link', { name: 'Create an account to accept' }).click();
    await expect(invited).toHaveURL(/\/signup\?invite=/);
    await expect(invited.getByLabel('Email')).toHaveValue(member.email);
    await invited.getByLabel('Your name').fill(member.name);
    await invited.getByLabel('Password').fill(member.password);
    await invited.getByRole('button', { name: 'Create account' }).click();
    await expect(invited).toHaveURL(new RegExp(`/w/${workspaceId}$`));
  });

  await test.step('a member cannot invite people', async () => {
    await invited.goto(`/w/${workspaceId}/settings/members`);
    await expect(
      invited.getByText('Only owners and admins can invite people and change roles'),
    ).toBeVisible();
    await expect(invited.getByRole('form', { name: 'Invite someone' })).toHaveCount(0);
  });

  await test.step('a member cannot connect accounts', async () => {
    await invited.goto(`/w/${workspaceId}/channels`);
    await expect(
      invited.getByText('Only workspace owners and admins can connect or disconnect accounts'),
    ).toBeVisible();
    await expect(invited.getByRole('button', { name: 'Connect Instagram account' })).toHaveCount(0);
  });

  await test.step('a member can still work with automations', async () => {
    await invited.goto(`/w/${workspaceId}/automations`);
    await expect(invited.getByRole('heading', { name: 'Automations', level: 1 })).toBeVisible();
  });

  await context.close();
});
