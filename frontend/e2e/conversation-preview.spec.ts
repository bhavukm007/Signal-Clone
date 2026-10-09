import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createDirect, login, openChat, phone } from './chatTestHelpers';

test('conversation previews update optimistically and persist attachment labels', async ({
  browser,
}) => {
  const [alice, bob] = await Promise.all([login(phone()), login(phone())]);
  const direct = await createDirect(alice, bob.user.id);
  const tab = await openChat(browser, alice, direct.id);
  const recipient = await openChat(browser, bob, direct.id);
  const row = tab.page.locator('.conversation-item').filter({
    has: tab.page.locator(`.conversation-copy[href="/chat/${direct.id}"]`),
  });
  const preview = row.locator('.conversation-preview');
  const recipientPreview = recipient.page
    .locator('.conversation-item')
    .filter({ has: recipient.page.locator(`.conversation-copy[href="/chat/${direct.id}"]`) })
    .locator('.conversation-preview');
  try {
    await expect(preview).toContainText('Start a conversation');
    await expect(recipientPreview).toContainText('Start a conversation');
    const body = `Optimistic preview ${randomUUID()}`;
    let releaseRequest: () => void = () => undefined;
    let blockNextMessage = true;
    await tab.page.route(`**/api/v1/conversations/${direct.id}/messages`, async (route) => {
      if (blockNextMessage && route.request().method() === 'POST') {
        blockNextMessage = false;
        await new Promise<void>((resolve) => {
          releaseRequest = resolve;
        });
      }
      await route.continue();
    });
    await tab.page.getByPlaceholder('Write a message…').fill(body);
    await tab.page.getByRole('button', { name: 'Send', exact: true }).click();
    try {
      await expect(preview).toContainText(body, { timeout: 800 });
    } finally {
      releaseRequest();
    }
    await expect(preview).toContainText(body);
    await expect(recipientPreview).toContainText(body);

    const fileName = `preview-${randomUUID()}.txt`;
    await tab.page.locator('.attach-button input[type=file]').setInputFiles({
      name: fileName,
      mimeType: 'text/plain',
      buffer: Buffer.from('attachment preview'),
    });
    await expect(tab.page.locator('.attachment-staging')).toContainText(fileName);
    await tab.page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(preview).toContainText(`📎 ${fileName}`);

    await tab.page.reload();
    await expect(tab.page.locator('.message-list')).toBeVisible();
    await expect(preview).toContainText(`📎 ${fileName}`);
  } finally {
    await tab.context.close();
    await recipient.context.close();
  }
});
