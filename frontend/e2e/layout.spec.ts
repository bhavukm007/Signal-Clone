import { expect, test } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const api = `${process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:8000'}/api/v1`;
const screenshots = process.env.PLAYWRIGHT_SCREENSHOT_DIR ?? '../docs/screenshots';
const viewports = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
];

async function createSession() {
  await fetch(`${api}/auth/request-otp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: '+91 90000 00001' }),
  });
  const response = await fetch(`${api}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: '+91 90000 00001', code: '123456' }),
  });
  if (!response.ok) throw new Error(`Demo login failed with ${response.status}`);
  return response.json() as Promise<{ token: string; user: object }>;
}

async function signedInPage(
  browser: Browser,
  viewport: { width: number; height: number },
  theme: string,
) {
  const session = await createSession();
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.addInitScript(
    ({ token, user, themeName }) => {
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

async function capture(page: Page, theme: string, width: number, name: string) {
  await mkdir(screenshots, { recursive: true });
  await page.screenshot({ path: `${screenshots}/${theme}-${width}-${name}.png` });
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth + 1);
}

test('responsive light and dark app views fit at phone, tablet, and desktop widths', async ({
  browser,
}) => {
  const session = await createSession();
  const response = await fetch(`${api}/conversations`, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  const conversations = (await response.json()) as Array<{ id: string; type: string }>;
  const direct = conversations.find((item) => item.type === 'direct');
  const group = conversations.find((item) => item.type === 'group');
  expect(direct).toBeTruthy();
  expect(group).toBeTruthy();

  for (const theme of ['light', 'dark']) {
    for (const viewport of viewports) {
      const { context, page } = await signedInPage(browser, viewport, theme);
      const width = viewport.width;
      await page.goto('/');
      await expect(page.locator('.conversation-item').first()).toBeVisible();
      await capture(page, theme, width, 'conversation-list');

      await page.goto(`/chat/${direct?.id}`);
      await expect(page.locator('.chat-header')).toBeVisible();
      await expect(page.locator('.composer')).toBeVisible();
      if (width <= 768) await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();
      const font = await page
        .locator('body')
        .evaluate((element) => getComputedStyle(element).fontFamily);
      expect(font).toContain('Inter Variable');
      await capture(page, theme, width, 'chat');

      await page.goto(`/chat/${group?.id}`);
      await page.getByRole('button', { name: 'More options' }).click();
      await expect(page.getByRole('dialog', { name: 'Group info' })).toBeVisible();
      await capture(page, theme, width, 'group-info');
      await page.keyboard.press('Escape');

      await page.goto('/settings');
      await expect(page.locator('.settings-page')).toBeVisible();
      if (width === 375)
        await expect(page.getByRole('button', { name: 'Back to chats' })).toBeVisible();
      await capture(page, theme, width, 'settings');

      await page.goto('/');
      await page.getByRole('button', { name: 'New chat' }).click();
      await expect(page.getByRole('dialog', { name: 'New message' })).toBeVisible();
      await capture(page, theme, width, 'new-chat');
      await context.close();
    }
  }
});

test('latest messages control stays clear of chat controls at 375px', async ({ browser }) => {
  const session = await createSession();
  const response = await fetch(`${api}/conversations`, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  const conversations = (await response.json()) as Array<{ id: string }>;
  const { context, page } = await signedInPage(browser, viewports[0], 'light');
  await page.goto(`/chat/${conversations[0]?.id}`);
  const messages = page.locator('.message-list');
  await messages.evaluate((element) => {
    element.scrollTop = 0;
    element.dispatchEvent(new Event('scroll'));
  });
  const latest = page.getByRole('button', { name: '↓ Latest messages' });
  await expect(latest).toBeVisible();
  const latestBox = await latest.boundingBox();
  const composerBox = await page.locator('.composer-wrap').boundingBox();
  const headerBox = await page.locator('.chat-header').boundingBox();
  expect(latestBox).toBeTruthy();
  expect(composerBox).toBeTruthy();
  expect(headerBox).toBeTruthy();
  expect(latestBox!.y + latestBox!.height).toBeLessThanOrEqual(composerBox!.y);
  expect(latestBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height);
  await context.close();
});

test('blocking confirms the action and shows the blocked conversation state', async ({
  browser,
}) => {
  const session = await createSession();
  const authHeaders = { Authorization: `Bearer ${session.token}` };
  const contactResponse = await fetch(`${api}/contacts`, { headers: authHeaders });
  const contacts = (await contactResponse.json()) as Array<{
    id: string;
    user: { id: string; display_name: string };
  }>;
  const contact = contacts[0];
  expect(contact).toBeTruthy();
  await fetch(`${api}/contacts/${contact?.id}/block`, {
    method: 'PUT',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ is_blocked: false }),
  });
  const direct = await fetch(`${api}/conversations/direct`, {
    method: 'POST',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ user_id: contact?.user.id }),
  });
  const conversation = (await direct.json()) as { id: string };
  const { context, page } = await signedInPage(browser, viewports[2], 'light');
  await page.goto('/');
  await page.getByRole('button', { name: 'New chat' }).click();
  await page.getByRole('button', { name: 'Block' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Block contact?' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm block' }).click();
  await expect(page.getByText('Contact blocked.')).toBeVisible();
  await page.goto(`/chat/${conversation.id}`);
  await expect(page.locator('.blocked-banner')).toContainText('Blocked');
  await context.close();
});

test('expired messages disappear from an open chat without a refresh', async ({ browser }) => {
  const session = await createSession();
  const authHeaders = { Authorization: `Bearer ${session.token}` };
  await fetch(`${api}/auth/request-otp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: '+91 90000 00002' }),
  });
  const second = await fetch(`${api}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: '+91 90000 00002', code: '123456' }),
  });
  const secondSession = (await second.json()) as { user: { id: string } };
  const direct = await fetch(`${api}/conversations/direct`, {
    method: 'POST',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ user_id: secondSession.user.id }),
  });
  const conversation = (await direct.json()) as { id: string };
  await fetch(`${api}/conversations/${conversation.id}`, {
    method: 'PATCH',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ disappearing_timer_seconds: 10 }),
  });
  const body = `Expires live ${randomUUID()}`;
  await fetch(`${api}/conversations/${conversation.id}/messages`, {
    method: 'POST',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ body, client_message_id: randomUUID() }),
  });
  const { context, page } = await signedInPage(browser, viewports[2], 'light');
  await page.goto(`/chat/${conversation.id}`);
  const messageBody = page.locator('.message-list').getByText(body);
  await expect(messageBody).toBeVisible();
  await expect(messageBody).toHaveCount(0, { timeout: 15000 });
  await context.close();
  await fetch(`${api}/conversations/${conversation.id}`, {
    method: 'PATCH',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ disappearing_timer_seconds: 0 }),
  });
});

test('conversation-list request failure shows a working retry control', async ({ browser }) => {
  const { context, page } = await signedInPage(browser, viewports[0], 'light');
  let attempts = 0;
  await page.route(`${api}/conversations`, async (route) => {
    attempts += 1;
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
  });
  await page.goto('/');
  const alert = page.getByRole('alert').filter({ hasText: 'Chats could not be loaded.' });
  await expect(alert).toBeVisible();
  const firstAttemptCount = attempts;
  await alert.getByRole('button', { name: 'Retry' }).click();
  await expect.poll(() => attempts).toBeGreaterThan(firstAttemptCount);
  await context.close();
});

test('message-history request failure shows a retry control', async ({ browser }) => {
  const session = await createSession();
  const response = await fetch(`${api}/conversations`, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  const conversations = (await response.json()) as Array<{ id: string }>;
  const conversation = conversations[0];
  expect(conversation).toBeTruthy();
  const { context, page } = await signedInPage(browser, viewports[2], 'light');
  let attempts = 0;
  await page.route('**/api/v1/conversations/**', async (route) => {
    if (!route.request().url().includes('/messages?limit=30')) {
      await route.continue();
      return;
    }
    attempts += 1;
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
  });
  await page.goto(`/chat/${conversation?.id}`);
  const alert = page.getByRole('alert').filter({ hasText: 'Messages could not be loaded.' });
  await expect(alert).toBeVisible();
  const firstAttemptCount = attempts;
  await alert.getByRole('button', { name: 'Retry' }).click();
  await expect.poll(() => attempts).toBeGreaterThan(firstAttemptCount);
  await context.close();
});

test('expired REST session clears the browser session and returns to welcome', async ({
  browser,
}) => {
  const { context, page } = await signedInPage(browser, viewports[0], 'light');
  await page.route(`${api}/auth/me`, async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Session expired' } }),
    });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Signal' })).toBeVisible();
  await expect
    .poll(async () => {
      const storage = await page.evaluate(() => localStorage.getItem('signal-auth'));
      return storage
        ? (JSON.parse(storage) as { state?: { token?: string | null } }).state?.token
        : undefined;
    })
    .toBeNull();
  await context.close();
});

test('unexpected WebSocket close displays the reconnecting banner', async ({ browser }) => {
  const { context, page } = await signedInPage(browser, viewports[2], 'light');
  await page.routeWebSocket('**/ws*', (socket) => {
    socket.close({ code: 1012, reason: 'Service restart' });
  });
  await page.goto('/');
  await expect(page.getByRole('status').filter({ hasText: 'Reconnecting' })).toBeVisible();
  await context.close();
});

test('unauthorized WebSocket close clears the session', async ({ browser }) => {
  const { context, page } = await signedInPage(browser, viewports[0], 'light');
  await page.routeWebSocket('**/ws*', (socket) => {
    socket.close({ code: 4401, reason: 'Unauthorized' });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Signal' })).toBeVisible();
  await context.close();
});

test('message body renders script-like text without executing markup', async ({ browser }) => {
  const session = await createSession();
  const authHeaders = { Authorization: `Bearer ${session.token}` };
  const response = await fetch(`${api}/conversations`, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  const conversations = (await response.json()) as Array<{ id: string; type: string }>;
  const direct = conversations.find((item) => item.type === 'direct');
  expect(direct).toBeTruthy();
  const contactResponse = await fetch(`${api}/contacts`, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  const contacts = (await contactResponse.json()) as Array<{ id: string }>;
  await Promise.all(
    contacts.map((contact) =>
      fetch(`${api}/contacts/${contact.id}/block`, {
        method: 'PUT',
        headers: { ...authHeaders, 'content-type': 'application/json' },
        body: JSON.stringify({ is_blocked: false }),
      }),
    ),
  );
  const { context, page } = await signedInPage(browser, viewports[2], 'light');
  let dialogOpened = false;
  page.on('dialog', (dialog) => {
    dialogOpened = true;
    void dialog.dismiss();
  });
  const payload = `<img src=x onerror="alert('xss')"> ${randomUUID()}`;
  await page.goto(`/chat/${direct?.id}`);
  const composer = page.getByPlaceholder('Write a message…');
  await composer.fill(payload);
  await composer.press('Enter');
  await expect(page.locator('.message-list').getByText(payload)).toBeVisible();
  expect(await page.locator('.message-list img').count()).toBe(0);
  expect(dialogOpened).toBe(false);
  await context.close();
});

test('replacing a toast keeps the newer notification visible', async ({ browser }) => {
  const { context, page } = await signedInPage(browser, viewports[2], 'light');
  await page.goto('/');
  await page.getByRole('button', { name: 'Calls, coming soon' }).click();
  await expect(page.getByText('Calls are coming soon.')).toBeVisible();
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: 'Stories, coming soon' }).click();
  const toast = page.getByText('Stories are coming soon.');
  await expect(toast).toBeVisible();
  await page.waitForTimeout(1300);
  await expect(toast).toBeVisible();
  await context.close();
});
