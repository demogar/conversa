import { expect, test } from '@playwright/test';
import { openWorkspace } from '../support/app';

test('the language can be switched to Spanish and back', async ({ page }) => {
  const workspaceId = await openWorkspace(page);
  const nav = page.getByRole('navigation');
  // The profile's language, saved to the account (the account page also has a
  // language picker for this browser only).
  const profileLanguage = (name: string, hint: string) =>
    page.getByRole('combobox', { name, description: hint });
  const english = ['Language', 'Used for the app and for the emails Conversa sends you.'] as const;
  const spanish = ['Idioma', 'Se usa en la app y en los correos que Conversa te envía.'] as const;

  await expect(nav.getByRole('link', { name: 'Automations' })).toBeVisible();

  await test.step('switches to Español on the account page', async () => {
    await page.goto('/account');
    await profileLanguage(...english).click();
    await page.getByRole('option', { name: 'Español' }).click();
    await expect(profileLanguage(...spanish)).toHaveText(/Español/);
  });

  await test.step('the navigation is in Spanish', async () => {
    await page.goto(`/w/${workspaceId}`);
    await expect(nav.getByRole('link', { name: 'Automatizaciones' })).toBeVisible();
  });

  await test.step('switches back to English', async () => {
    await page.goto('/account');
    await profileLanguage(...spanish).click();
    await page.getByRole('option', { name: 'English' }).click();
    await expect(profileLanguage(...english)).toHaveText(/English/);
    await page.goto(`/w/${workspaceId}`);
    await expect(nav.getByRole('link', { name: 'Automations' })).toBeVisible();
  });
});
