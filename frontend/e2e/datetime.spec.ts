import { expect, test, type BrowserContext, type Page, type WebSocket } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { api, createDirect, login, openChat, phone } from './chatTestHelpers';

test('API, WebSocket, and chat timestamps are UTC while the UI shows Asia/Kolkata time', async ({
  browser,
}) => {
  const [alice, bob] = await Promise.all([login(phone()), login(phone())]);
  const direct = await createDirect(alice, bob.user.id);
  const headers = { Authorization: `Bearer ${alice.token}` };
  const timer = await fetch(`${api}/conversations/${direct.id}`, {
    method: 'PATCH',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ disappearing_timer_seconds: 3600 }),
  });
  expect(timer.ok).toBeTruthy();

  const aliceTab = await openChat(browser, alice, direct.id);
  let bobTab: { context: BrowserContext; page: Page } | undefined;
  const wsMessages: Array<{ payload?: { message?: Record<string, unknown> } }> = [];
  try {
    const expectedLastSeen = await aliceTab.page.evaluate((value) => {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(value));
    }, bob.user.last_seen_at);
    await expect(aliceTab.page.locator('.chat-heading small')).toHaveText(
      `last seen ${expectedLastSeen}`,
    );
    bobTab = await openChat(browser, bob, direct.id, (socket: WebSocket) => {
      socket.on('framereceived', (frame) => {
        const raw = typeof frame.payload === 'string' ? frame.payload : frame.payload.toString();
        try {
          const event = JSON.parse(raw);
          if (event.type === 'message.new') wsMessages.push(event);
        } catch {
          // Ignore non-JSON frames such as protocol pings.
        }
      });
    });

    const body = `Local time ${randomUUID()}`;
    const responsePromise = aliceTab.page.waitForResponse(
      (response) =>
        response.url().includes(`/conversations/${direct.id}/messages`) &&
        response.request().method() === 'POST',
    );
    await aliceTab.page.getByPlaceholder('Write a message…').fill(body);
    await aliceTab.page.getByRole('button', { name: 'Send', exact: true }).click();
    const response = await responsePromise;
    const message = await response.json();
    expect(message.created_at).toMatch(/Z$/);
    expect(message.expires_at).toMatch(/Z$/);
    await expect(aliceTab.page.locator('.date-divider').last()).toHaveText('Today');
    const expectedTime = await aliceTab.page.evaluate((value) => {
      return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(
        new Date(value),
      );
    }, message.created_at);
    await expect(
      aliceTab.page.locator('.message-row').filter({ hasText: body }).locator('time'),
    ).toHaveText(expectedTime);

    const conversations = await fetch(`${api}/conversations`, { headers }).then((r) => r.json());
    const summary = conversations.find((item: { id: string }) => item.id === direct.id);
    expect(summary.last_activity_at).toMatch(/Z$/);
    expect(summary.last_message.created_at).toMatch(/Z$/);
    expect(summary.last_seen_at).toMatch(/Z$/);
    await expect.poll(() => wsMessages.length).toBeGreaterThan(0);
  } finally {
    await bobTab?.context.close();
    await aliceTab.context.close();
  }
});
