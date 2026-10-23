import { expect, test } from '@playwright/test';
import { apiCall, type Channel, openWorkspace } from '../support/app';

interface OutboxEntry {
  kind: 'private_reply' | 'message' | 'public_reply';
  recipient: string;
  message: { text: string; buttons?: Array<{ type: string; label: string; url?: string }> };
}

const AUTOMATION = 'TikTok price list';

test('a TikTok direct message with the keyword gets the answer, and comments are not offered', async ({
  page,
}) => {
  const workspaceId = await openWorkspace(page);
  let channel!: Channel;

  await test.step('connects a sandbox TikTok account', async () => {
    await page.goto(`/w/${workspaceId}/channels`);
    await page.getByRole('button', { name: 'Connect TikTok account' }).first().click();
    await expect(page.getByText('Account connected')).toBeVisible();
    const channels = await apiCall<Channel[]>(
      page.request,
      'GET',
      `/workspaces/${workspaceId}/channels`,
    );
    channel = channels.find((item) => item.type === 'TIKTOK')!;
    expect(channel).toBeDefined();
    await expect(
      page
        .getByRole('article')
        .filter({ has: page.getByRole('heading', { name: `@${channel.username}` }) })
        .getByText(/^TikTok/),
    ).toBeVisible();
  });

  await test.step('builds a direct message automation; the comment trigger is unavailable', async () => {
    await page.goto(`/w/${workspaceId}/automations/new`);
    await page.getByLabel('Name', { exact: true }).fill(AUTOMATION);
    await page.getByRole('combobox', { name: 'Account' }).click();
    await page.getByRole('option', { name: new RegExp(`^@${channel.username}`) }).click();
    await expect(page.getByRole('radio', { name: /^A comment/ })).toBeDisabled();
    await expect(page.getByRole('radio', { name: /^A direct message/ })).toBeChecked();
    await expect(page.getByText(/Not on TikTok/)).toBeVisible();

    const keyword = page.getByLabel('Add a keyword');
    await keyword.fill('PRICE');
    await keyword.press('Enter');

    await page.getByLabel('Direct message', { exact: true }).fill('Hi {username}, the prices:');
    await page.getByRole('button', { name: 'Add button' }).click();
    await page.getByLabel('Button label').fill('Prices');
    await page.getByLabel('Web address').fill('https://example.com/prices');
    await expect(page.getByText(/TikTok has no link buttons/)).toBeVisible();

    await page.getByRole('button', { name: 'Save and activate' }).click();
    await expect(page.getByText('Automation saved and active')).toBeVisible();
  });

  await test.step('simulates a direct message from @lucia', async () => {
    await page.goto(`/w/${workspaceId}/channels`);
    await page
      .getByRole('article')
      .filter({ has: page.getByRole('heading', { name: `@${channel.username}` }) })
      .getByRole('button', { name: 'Simulate an event' })
      .click();
    const dialog = page.getByRole('dialog', { name: `Simulate an event on @${channel.username}` });
    await expect(dialog.getByRole('radio')).toHaveCount(0);
    await dialog.getByLabel('From (username)').fill('lucia');
    await dialog.getByLabel('Message', { exact: true }).fill('what is the PRICE?');
    await dialog.getByRole('button', { name: 'Send event' }).click();
    await expect(page.getByText('Event sent')).toBeVisible();
  });

  await test.step('the answer goes to the conversation with the tracked link', async () => {
    await expect(async () => {
      const outbox = await apiCall<OutboxEntry[]>(
        page.request,
        'GET',
        `/workspaces/${workspaceId}/channels/${channel.id}/sandbox/outbox`,
      );
      const reply = outbox.find((entry) => entry.kind === 'message');
      expect(reply).toBeDefined();
      expect(reply!.message.text).toBe('Hi @lucia, the prices:');
      expect(reply!.message.buttons?.[0]?.url).toMatch(/\/l\/[^/]+/);
    }).toPass({ timeout: 30_000 });
  });
});
