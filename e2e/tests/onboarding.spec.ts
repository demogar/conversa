import { expect, test } from '@playwright/test';
import { owner } from '../support/app';
import { ownerStateFile } from '../support/stack';

// The setup project: a fresh installation, its first account, and the
// signed-in session every other spec starts from.
test('the first person sets up the installation and signs back in', async ({ page }) => {
  await test.step('a first visit is sent to sign in', async () => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login(\?|$)/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  await test.step('creates the owner account on the setup screen', async () => {
    await page.getByRole('link', { name: 'Create one' }).click();
    await expect(page).toHaveURL(/\/signup/);
    await expect(page.getByRole('heading', { name: 'Set up Conversa' })).toBeVisible();
    await expect(page.getByText('This is the first account on this installation.')).toBeVisible();

    await page.getByLabel('Your name').fill(owner.name);
    await page.getByLabel('Email').fill(owner.email);
    await page.getByLabel('Password').fill(owner.password);
    await page.getByRole('button', { name: 'Create account' }).click();
  });

  await test.step('lands on the overview with the getting-started checklist', async () => {
    await expect(page).toHaveURL(/\/w\/[^/]+$/);
    await expect(page.getByRole('heading', { name: 'Overview', level: 1 })).toBeVisible();
    // The first workspace is named after its owner.
    await expect(
      page.getByText(`How the automations in ${owner.name} did in the last 30 days.`),
    ).toBeVisible();
    const checklist = page.getByRole('region', { name: 'Get started' });
    await expect(checklist).toBeVisible();
    await expect(checklist.getByText('Connect your Instagram account')).toBeVisible();
    await expect(checklist.getByText('Create your first automation')).toBeVisible();
    await expect(checklist.getByRole('link', { name: 'Connect Instagram' })).toBeVisible();
  });

  await test.step('signs out', async () => {
    await page.getByRole('button', { name: `Account menu for ${owner.name}` }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login(\?|$)/);
    // With the first account made, sign-up is by invitation only.
    await expect(page.getByRole('link', { name: 'Create one' })).toHaveCount(0);
  });

  await test.step('a wrong password is refused', async () => {
    await page.getByLabel('Email').fill(owner.email);
    await page.getByLabel('Password').fill('not the right password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('That email and password do not match.')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  await test.step('signs in with the right password', async () => {
    await page.getByLabel('Password').fill(owner.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/w\/[^/]+$/);
    await expect(page.getByRole('heading', { name: 'Overview', level: 1 })).toBeVisible();
  });

  await page.context().storageState({ path: ownerStateFile });
});
