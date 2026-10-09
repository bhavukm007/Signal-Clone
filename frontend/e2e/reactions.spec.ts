import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { api, login, openChat } from './chatTestHelpers';

test('React click opens quick reactions rather than applying a fixed heart', async ({
  browser,
}) => {
  const session = await login('+919000000001');
  const conversationResponse = await fetch(`${api}/conversations`, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  const conversations = (await conversationResponse.json()) as Array<{
    id: string;
    type: 'direct' | 'group';
  }>;
  const conversationId = conversations.find((item) => item.type === 'direct')?.id;
  expect(conversationId).toBeTruthy();
  const clientMessageId = randomUUID();
  const body = `reaction repro ${clientMessageId}`;
  const sent = await fetch(`${api}/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ body, client_message_id: clientMessageId }),
  });
  expect(sent.ok).toBeTruthy();

  const { context, page } = await openChat(browser, session, conversationId!);
  const message = page.locator('.message-row').filter({ hasText: body });
  await expect(message).toBeVisible();
  const reactButton = message.getByRole('button', { name: /React/ });
  await reactButton.click();
  const quick = page.getByRole('toolbar', { name: 'Quick reactions' });
  await expect(quick).toBeVisible();
  await quick.getByRole('button', { name: 'React with emoji 😂' }).click();
  await expect(message.locator('.reaction-chip')).toContainText('😂');
  await context.close();
});

test('quick reactions toggle, full picker searches, and context menu stays in a narrow viewport', async ({
  browser,
}) => {
  const session = await login('+919000000001');
  const conversationResponse = await fetch(`${api}/conversations`, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  const conversations = (await conversationResponse.json()) as Array<{
    id: string;
    type: 'direct' | 'group';
  }>;
  const conversationId = conversations.find((item) => item.type === 'direct')?.id;
  expect(conversationId).toBeTruthy();
  const clientMessageId = randomUUID();
  const body = `emoji picker ${clientMessageId}`;
  const sent = await fetch(`${api}/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ body, client_message_id: clientMessageId }),
  });
  expect(sent.ok).toBeTruthy();
  const { context, page } = await openChat(browser, session, conversationId!);
  const message = page.locator('.message-row').filter({ hasText: body });
  await expect(message).toBeVisible();
  const react = message.locator('.message-action[aria-label="React"]');
  await react.focus();
  await react.press('Enter');
  const quick = page.getByRole('toolbar', { name: 'Quick reactions' });
  await expect(quick).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(message.locator('.reaction-chip')).toContainText('❤️');

  await react.click();
  await quick.getByRole('button', { name: 'React with emoji ❤️' }).click();
  await expect(message.locator('.reaction-chip')).toHaveCount(0);
  await react.click();
  await quick.getByRole('button', { name: 'More emoji' }).click();
  const picker = page.getByRole('region', { name: 'Emoji picker' });
  await expect(picker).toBeVisible();
  await picker.getByRole('textbox', { name: 'Search emoji' }).fill('pizza');
  await picker.getByRole('button', { name: 'pizza 🍕' }).click();
  await expect(message.locator('.reaction-chip')).toContainText('🍕');
  await page.setViewportSize({ width: 320, height: 800 });
  await expect(page.locator('body')).toHaveJSProperty(
    'scrollWidth',
    await page.evaluate(() => document.documentElement.clientWidth),
  );

  const composer = page.getByRole('textbox', { name: 'Write a message…' });
  await composer.fill('send pizza ');
  await composer.evaluate((element) => (element as HTMLTextAreaElement).setSelectionRange(5, 5));
  await page.getByRole('button', { name: 'Emoji' }).click();
  const composerPicker = page.getByRole('region', { name: 'Emoji picker' });
  await composerPicker.getByRole('textbox', { name: 'Search emoji' }).fill('pizza');
  await composerPicker.getByRole('button', { name: 'pizza 🍕' }).click();
  await expect(composer).toHaveValue('send 🍕pizza ');

  await message.click({ button: 'right' });
  const menu = page.getByRole('menu', { name: 'Message actions' });
  await expect(menu).toBeVisible();
  const box = await menu.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  await page.keyboard.press('Escape');
  await message.locator('.bubble').evaluate((element) => {
    const touch = new Touch({
      identifier: 7,
      target: element,
      clientX: 48,
      clientY: 48,
    });
    element.dispatchEvent(
      new TouchEvent('touchstart', {
        bubbles: true,
        touches: [touch],
        targetTouches: [touch],
        changedTouches: [touch],
      }),
    );
  });
  await page.waitForTimeout(500);
  await expect(menu).toBeVisible();
  await message.locator('.bubble').evaluate((element) => {
    const touch = new Touch({ identifier: 7, target: element, clientX: 48, clientY: 48 });
    element.dispatchEvent(
      new TouchEvent('touchend', { bubbles: true, changedTouches: [touch], touches: [] }),
    );
  });
  await context.close();
});

test('message reaction is delivered live to another browser context', async ({ browser }) => {
  const first = await login('+919000000001');
  const second = await login('+919000000002');
  const response = await fetch(`${api}/conversations`, {
    headers: { Authorization: `Bearer ${first.token}` },
  });
  const conversations = (await response.json()) as Array<{ id: string; type: 'group' | 'direct' }>;
  const conversationId = conversations.find((item) => item.type === 'group')?.id;
  expect(conversationId).toBeTruthy();
  const clientMessageId = randomUUID();
  const body = `live reaction ${clientMessageId}`;
  const send = await fetch(`${api}/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${first.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ body, client_message_id: clientMessageId }),
  });
  expect(send.ok).toBeTruthy();
  const one = await openChat(browser, first, conversationId!);
  const two = await openChat(browser, second, conversationId!);
  const messageOne = one.page.locator('.message-row').filter({ hasText: body });
  const messageTwo = two.page.locator('.message-row').filter({ hasText: body });
  await expect(messageOne).toBeVisible();
  await expect(messageTwo).toBeVisible();
  await messageOne.getByRole('button', { name: 'React' }).click();
  await one.page
    .getByRole('toolbar', { name: 'Quick reactions' })
    .getByRole('button', { name: 'React with emoji 😂' })
    .click();
  await expect(messageTwo.locator('.reaction-chip')).toContainText('😂', { timeout: 5000 });
  await one.context.close();
  await two.context.close();
});
