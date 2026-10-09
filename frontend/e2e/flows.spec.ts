import { expect, test, type Browser } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const api = `${process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:8000'}/api/v1`;
const viewports = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
];

async function createSession(identifier: string) {
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
  if (!response.ok) throw new Error(`Demo login failed with ${response.status}`);
  return response.json() as Promise<{ token: string; user: { id: string } }>;
}

async function signedInPage(
  browser: Browser,
  viewport: { width: number; height: number },
  theme: string,
  identifier = '+91 90000 00001',
) {
  const session = await createSession(identifier);
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.addInitScript(
    ({ token, user }) => {
      localStorage.setItem('signal-auth', JSON.stringify({ state: { token, user }, version: 0 }));
      localStorage.setItem(
        'signal-ui',
        JSON.stringify({ state: { theme: themeName }, version: 0 }),
      );
    },
    { ...session, themeName: theme },
  );
  return { context, page };
}

test('group receipts, reactions, replies, uploads, search, timer, and shortcuts work', async ({
  browser,
}) => {
  test.setTimeout(90000);
  const first = await createSession('+91 90000 00001');
  const second = await createSession('+91 90000 00002');
  const headers = { Authorization: `Bearer ${first.token}`, 'content-type': 'application/json' };
  const groupResponse = await fetch(`${api}/groups`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: `Playwright ${randomUUID()}`,
      member_ids: [(second.user as { id: string }).id],
    }),
  });
  expect(groupResponse.ok).toBeTruthy();
  const group = (await groupResponse.json()) as { id: string };
  const { context: firstContext, page: firstPage } = await signedInPage(
    browser,
    viewports[2],
    'light',
  );
  const { context: secondContext, page: secondPage } = await signedInPage(
    browser,
    viewports[2],
    'light',
    '+91 90000 00002',
  );
  await firstPage.goto(`/chat/${group.id}`);
  await secondPage.goto(`/chat/${group.id}`);
  const body = `Group receipt ${randomUUID()}`;
  await firstPage.getByPlaceholder('Write a message…').fill(body);
  await firstPage.getByRole('button', { name: 'Send' }).click();
  await expect(secondPage.locator('.message-list').getByText(body)).toBeVisible();
  await expect(firstPage.getByLabel('Message delivered')).toBeVisible();
  await secondPage.locator('.message-list').evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event('scroll'));
  });
  await expect(firstPage.getByLabel('Message read')).toBeVisible({ timeout: 10000 });

  const firstMessage = firstPage.locator('.message-row').filter({ hasText: body });
  await firstMessage.getByRole('button', { name: 'React with heart' }).click();
  await expect(firstMessage.locator('.reaction-chip')).toContainText('❤️');
  await firstMessage.getByRole('button', { name: 'Reply' }).click();
  await expect(firstPage.locator('.reply-preview')).toContainText(body);
  const quote = `Quoted ${randomUUID()}`;
  await firstPage.getByPlaceholder('Write a message…').fill(quote);
  await firstPage.getByRole('button', { name: 'Send' }).click();
  await expect(
    firstPage.locator('.message-row').filter({ hasText: quote }).locator('.quoted-reply'),
  ).toContainText(body);

  const uploadName = `attachment-${randomUUID()}.txt`;
  await firstPage.locator('.attach-button input[type=file]').setInputFiles({
    name: uploadName,
    mimeType: 'text/plain',
    buffer: Buffer.from('playwright attachment'),
  });
  await expect(firstPage.locator('.attachment-staging')).toContainText(uploadName);
  await firstPage.getByRole('button', { name: 'Send' }).click();
  await expect(firstPage.locator('.message-list').getByText(uploadName)).toBeVisible();

  await firstPage.getByRole('button', { name: 'Search messages' }).click();
  await firstPage.getByLabel('Search this conversation').fill('Group receipt');
  await expect(firstPage.locator('.message-list').getByText(body)).toBeVisible();
  await firstPage.getByRole('button', { name: 'Close message search' }).click();

  await firstPage.keyboard.press('Control+n');
  await expect(firstPage.getByRole('dialog', { name: 'New message' })).toBeVisible();
  await firstPage.keyboard.press('Escape');
  await expect(firstPage.getByRole('dialog', { name: 'New message' })).toHaveCount(0);

  await firstPage.getByRole('button', { name: 'More options' }).click();
  await firstPage.getByLabel('Disappearing message timer').selectOption('30');
  await expect(firstPage.getByLabel('Disappearing message timer')).toHaveValue('30');
  await firstPage.keyboard.press('Escape');
  const expiring = `Disappears ${randomUUID()}`;
  await firstPage.getByPlaceholder('Write a message…').fill(expiring);
  await firstPage.getByRole('button', { name: 'Send' }).click();
  await expect(firstPage.locator('.message-list').getByText(expiring)).toBeVisible();
  await expect(firstPage.locator('.message-list').getByText(expiring)).toHaveCount(0, {
    timeout: 40000,
  });
  await firstContext.close();
  await secondContext.close();
});
