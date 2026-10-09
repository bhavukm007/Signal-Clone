import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const api = `${process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:8000'}/api/v1`;

async function login(identifier: string) {
  const request = async (path: string, body: object) => {
    const response = await fetch(`${api}/auth/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Login request ${path} returned ${response.status}`);
    return response.json();
  };
  await request('request-otp', { identifier });
  return request('verify-otp', { identifier, code: '123456' }) as Promise<{
    token: string;
    user: { id: string; display_name: string };
  }>;
}

async function openChat(
  browser: Browser,
  session: Awaited<ReturnType<typeof login>>,
  conversationId: string,
): Promise<{ context: BrowserContext; page: Page; socket: Promise<unknown> }> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(({ token, user }) => {
    localStorage.setItem('signal-auth', JSON.stringify({ state: { token, user }, version: 0 }));
    localStorage.setItem('signal-ui', JSON.stringify({ state: { theme: 'light' }, version: 0 }));
  }, session);
  const page = await context.newPage();
  const socket = page.waitForEvent('websocket');
  await page.goto(`/chat/${conversationId}`);
  await expect(page.locator('.message-list')).toBeVisible();
  return { context, page, socket };
}

async function send(page: Page, body: string) {
  await page.getByPlaceholder('Write a message…').fill(body);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
}

async function visibleConcurrentBodies(page: Page, bodies: string[]) {
  const rows = page.locator('.message-row');
  await expect
    .poll(async () => {
      const contents = await rows.allTextContents();
      return contents.filter((content) => bodies.some((body) => content.includes(body))).length;
    })
    .toBe(bodies.length);
  const contents = await rows.allTextContents();
  return contents
    .filter((content) => bodies.some((body) => content.includes(body)))
    .map((content) => bodies.find((body) => content.includes(body)));
}

test('three concurrent chats preserve group order, previews, and unread badges', async ({
  browser,
}) => {
  test.setTimeout(60000);
  const identifiers = Array.from(
    { length: 3 },
    () => `+91 7${randomUUID().replace(/\D/g, '').padEnd(9, '0').slice(0, 9)}`,
  );
  const [alice, bob, chandra] = await Promise.all([
    login(identifiers[0]!),
    login(identifiers[1]!),
    login(identifiers[2]!),
  ]);
  const headers = {
    Authorization: `Bearer ${alice.token}`,
    'content-type': 'application/json',
  };
  const groupResponse = await fetch(`${api}/groups`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: `Concurrent ${randomUUID()}`,
      member_ids: [bob.user.id, chandra.user.id],
    }),
  });
  expect(groupResponse.ok).toBeTruthy();
  const group = (await groupResponse.json()) as { id: string };
  const directResponse = await fetch(`${api}/conversations/direct`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ user_id: chandra.user.id }),
  });
  expect(directResponse.ok).toBeTruthy();
  const direct = (await directResponse.json()) as { id: string };

  const aliceTab = await openChat(browser, alice, group.id);
  const bobTab = await openChat(browser, bob, group.id);
  const chandraTab = await openChat(browser, chandra, direct.id);
  try {
    await Promise.all([aliceTab.socket, bobTab.socket, chandraTab.socket]);
    const suffix = randomUUID().slice(0, 8);
    const aliceBody = `Concurrent Alice ${suffix}`;
    const bobBody = `Concurrent Bob ${suffix}`;
    const dmBody = `Concurrent Chandra DM ${suffix}`;

    await Promise.all([
      send(aliceTab.page, aliceBody),
      send(bobTab.page, bobBody),
      send(chandraTab.page, dmBody),
    ]);

    const expectedBodies = [aliceBody, bobBody];
    const historyResponse = await fetch(`${api}/conversations/${group.id}/messages?limit=100`, {
      headers,
    });
    const history = (await historyResponse.json()) as { body: string }[];
    const serverOrder = history
      .filter((message) => expectedBodies.includes(message.body))
      .map((message) => message.body);
    expect(serverOrder).toHaveLength(2);
    await expect
      .poll(async () =>
        Promise.all([
          visibleConcurrentBodies(aliceTab.page, expectedBodies),
          visibleConcurrentBodies(bobTab.page, expectedBodies),
        ]),
      )
      .toEqual([serverOrder, serverOrder]);
    const aliceOrder = serverOrder;
    await expect(
      chandraTab.page.locator('.message-list').getByText(dmBody, { exact: true }),
    ).toHaveCount(1);

    const aliceDmRow = aliceTab.page
      .locator('.conversation-item')
      .filter({ has: aliceTab.page.locator(`.conversation-copy[href="/chat/${direct.id}"]`) });
    await expect(aliceDmRow).toContainText(dmBody);
    await expect(aliceDmRow.locator('.unread-badge')).toHaveText('1');

    await bobTab.page.reload();
    await expect(bobTab.page.locator('.message-list')).toBeVisible();
    const bobGroupRow = bobTab.page
      .locator('.conversation-item')
      .filter({ has: bobTab.page.locator(`.conversation-copy[href="/chat/${group.id}"]`) });
    await expect(bobGroupRow).toContainText(aliceOrder[1]!);
    await expect(bobGroupRow.locator('.unread-badge')).toHaveCount(0);
  } finally {
    await Promise.all([
      aliceTab.context.close(),
      bobTab.context.close(),
      chandraTab.context.close(),
    ]);
  }
});
