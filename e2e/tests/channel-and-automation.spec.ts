import { expect, test } from '@playwright/test';
import { apiCall, type Channel, openWorkspace } from '../support/app';

interface OutboxEntry {
  kind: 'private_reply' | 'message' | 'public_reply';
  recipient: string;
  commentId: string | null;
  message: { text: string; buttons?: Array<{ type: string; label: string; url?: string }> };
}

const AUTOMATION = 'Guide for commenters';
const DESTINATION = 'https://example.com/guide';

test('a comment with the keyword gets a direct message with a tracked link', async ({ page }) => {
  const workspaceId = await openWorkspace(page);
  let channel!: Channel;

  await test.step('connects the sandbox Instagram account', async () => {
    await page.getByRole('navigation').getByRole('link', { name: 'Channels' }).click();
    await expect(page.getByRole('heading', { name: 'Channels', level: 1 })).toBeVisible();
    await expect(page.getByText('Sandbox mode')).toBeVisible();
    await page.getByRole('button', { name: 'Connect Instagram account' }).first().click();
    await expect(page.getByText('Instagram account connected')).toBeVisible();

    const card = page
      .getByRole('article')
      .filter({ has: page.getByRole('heading', { name: /^@sandbox_/ }) });
    await expect(card).toBeVisible();
    await expect(card.getByText('Active')).toBeVisible();
    const channels = await apiCall<Channel[]>(
      page.request,
      'GET',
      `/workspaces/${workspaceId}/channels`,
    );
    expect(channels).toHaveLength(1);
    channel = channels[0]!;
  });

  await test.step('builds a comment automation on one post', async () => {
    await page.goto(`/w/${workspaceId}/automations/new`);
    await expect(page.getByRole('heading', { name: 'New automation', level: 1 })).toBeVisible();

    await page.getByLabel('Name', { exact: true }).fill(AUTOMATION);
    // The only account is picked already.
    await expect(page.getByRole('combobox', { name: 'Account' })).toContainText(
      `@${channel.username}`,
    );

    await page.getByRole('radio', { name: /^Specific posts/ }).check();
    await page.getByRole('checkbox', { name: /New guide is out!/ }).check();
    await expect(page.getByText('1 post selected')).toBeVisible();

    const keyword = page.getByLabel('Add a keyword');
    await keyword.fill('LINK');
    await keyword.press('Enter');
    await expect(
      page.getByRole('grid', { name: 'Keywords' }).getByRole('row', { name: 'LINK' }),
    ).toBeVisible();

    await page.getByLabel('Test a comment').fill('Send the LINK please');
    await expect(page.getByText('Matches “LINK”')).toBeVisible();

    await page.getByRole('switch', { name: 'Reply publicly to the comment' }).click();
    await page.getByLabel('Reply 1').fill('Sent you a DM');

    await page
      .getByLabel('Direct message', { exact: true })
      .fill('Hi {username}, here is the guide:');
    await page.getByRole('button', { name: 'Add button' }).click();
    await page.getByLabel('Button label').fill('Get the guide');
    await page.getByLabel('Web address').fill(DESTINATION);

    await page.getByRole('button', { name: 'Save and activate' }).click();
    await expect(page.getByText('Automation saved and active')).toBeVisible();
  });

  await test.step('the automation is listed as active', async () => {
    await expect(page).toHaveURL(new RegExp(`/w/${workspaceId}/automations$`));
    const row = page.getByRole('row').filter({ hasText: AUTOMATION });
    await expect(row).toBeVisible();
    await expect(row.getByText('Active')).toBeVisible();
  });

  await test.step('simulates a comment from @maria', async () => {
    await page.goto(`/w/${workspaceId}/channels`);
    await page.getByRole('button', { name: 'Simulate an event' }).click();
    const dialog = page.getByRole('dialog', { name: `Simulate an event on @${channel.username}` });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('From (Instagram username)').fill('maria');
    await dialog.getByRole('combobox', { name: 'Post' }).click();
    await page.getByRole('option', { name: /New guide is out!/ }).click();
    await dialog.getByLabel('Comment', { exact: true }).fill('Send the LINK please');
    await dialog.getByRole('button', { name: 'Send event' }).click();
    await expect(page.getByText('Event sent')).toBeVisible();
    await expect(dialog).toBeHidden();
  });

  await test.step('activity shows the message as sent', async () => {
    await page.goto(`/w/${workspaceId}/activity`);
    const row = page
      .getByRole('table', { name: 'Automation activity' })
      .getByRole('row')
      .filter({ hasText: '@maria' });
    // The worker runs the automation in the background: reload until it has.
    await expect(async () => {
      await page.reload();
      await expect(row.getByText('Sent', { exact: true }).first()).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    await expect(row).toContainText(AUTOMATION);
    await expect(row.getByRole('code').or(row.locator('code'))).toHaveText(/^link$/i);
  });

  let trackedUrl = '';
  await test.step('the private reply names @maria and carries a tracked link', async () => {
    const outbox = await apiCall<OutboxEntry[]>(
      page.request,
      'GET',
      `/workspaces/${workspaceId}/channels/${channel.id}/sandbox/outbox`,
    );
    const reply = outbox.find((entry) => entry.kind === 'private_reply');
    expect(reply, JSON.stringify(outbox)).toBeDefined();
    expect(reply!.message.text).toContain('@maria');
    const button = reply!.message.buttons?.find((b) => b.label === 'Get the guide');
    expect(button?.url).toMatch(/\/l\/[^/]+$/);
    trackedUrl = button!.url!;

    const publicReply = outbox.find((entry) => entry.kind === 'public_reply');
    expect(publicReply?.message.text).toBe('Sent you a DM');
  });

  await test.step('the tracked link redirects to the destination', async () => {
    const response = await page.request.get(new URL(trackedUrl).pathname, { maxRedirects: 0 });
    expect(response.status()).toBe(302);
    expect(response.headers()['location']).toBe(DESTINATION);
  });

  await test.step('the overview counts the message', async () => {
    await page.goto(`/w/${workspaceId}`);
    const sent = page.locator('[data-slot="stat"]').filter({ hasText: 'Messages sent' });
    await expect(sent.locator('[data-part="value"]')).toHaveText(/^[1-9]\d*$/);
  });
});
