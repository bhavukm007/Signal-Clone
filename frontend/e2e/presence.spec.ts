import { expect, test, type Browser } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const api = `${process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:8000'}/api/v1`;

async function login(identifier: string) {
  await fetch(`${api}/auth/request-otp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier }),
  });
  const response = await fetch(`${api}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier, code: '123456' }),
  });
  if (!response.ok) throw new Error(`Login failed: ${response.status}`);
  return response.json() as Promise<{ token: string; user: { id: string } }>;
}

async function pageFor(browser: Browser, identifier: string) {
  const session = await login(identifier);
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.addInitScript(
    (auth) => localStorage.setItem('signal-auth', JSON.stringify({ state: auth, version: 0 })),
    session,
  );
  return { context, page, session };
}

test('presence snapshots, live connect, grace disconnect and receipt ticks update across two users', async ({
  browser,
}) => {
  test.setTimeout(30000);
  const first = await pageFor(browser, '+919000000001');
  const second = await pageFor(browser, '+919000000002');
  const directResponse = await fetch(`${api}/conversations/direct`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${first.session.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ user_id: second.session.user.id }),
  });
  const direct = (await directResponse.json()) as { id: string };
  await first.page.goto(`/chat/${direct.id}`);
  await expect(first.page.locator('.chat-heading small')).not.toHaveText('online');

  const message = `Presence tick ${randomUUID()}`;
  await first.page.getByPlaceholder('Write a message…').fill(message);
  await first.page.getByRole('button', { name: 'Send', exact: true }).click();
  const sent = first.page.locator('.message-row').filter({ hasText: message }).getByLabel('Sent');
  await expect(sent).toBeVisible();

  await second.page.goto('/');
  await expect(first.page.locator('.chat-heading small')).toHaveText('online', { timeout: 10000 });
  await expect(
    first.page.locator('.message-row').filter({ hasText: message }).getByLabel('Delivered'),
  ).toBeVisible({ timeout: 10000 });
  await second.page.goto(`/chat/${direct.id}`);
  await expect(second.page.locator('.chat-heading small')).toHaveText('online');
  await expect(
    first.page.locator('.message-row').filter({ hasText: message }).getByLabel('Read'),
  ).toBeVisible({ timeout: 10000 });
  await expect(second.page.locator('.message-list').getByText(message)).toBeVisible();
  const reply = `Presence reply ${randomUUID()}`;
  await second.page.getByPlaceholder('Write a message…').fill(reply);
  await second.page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(first.page.locator('.message-list').getByText(reply)).toBeVisible();
  await expect(
    second.page.locator('.message-row').filter({ hasText: reply }).getByLabel('Read'),
  ).toBeVisible({ timeout: 10000 });
  await second.context.close();
  await expect(first.page.locator('.chat-heading small')).not.toHaveText('online', {
    timeout: 10000,
  });
  await first.context.close();
});
