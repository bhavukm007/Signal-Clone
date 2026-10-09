import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

const api = `${process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:8000'}/api/v1`;
let cachedSession: Promise<{ token: string; user: { id: string } }> | undefined;

async function session() {
  cachedSession ??= requestSession();
  return cachedSession;
}

async function requestSession() {
  const identifier = '+919000000001';
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
  return (await response.json()) as { token: string; user: { id: string } };
}

async function signedInPage(
  browser: Browser,
  viewport: { width: number; height: number },
  auth: Awaited<ReturnType<typeof session>>,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ viewport });
  await context.addInitScript((value) => {
    localStorage.setItem('signal-auth', JSON.stringify({ state: value, version: 0 }));
    localStorage.setItem('signal-ui', JSON.stringify({ state: { theme: 'light' }, version: 0 }));
  }, auth);
  const page = await context.newPage();
  return { context, page };
}

async function directConversation(auth: Awaited<ReturnType<typeof session>>) {
  const headers = { Authorization: `Bearer ${auth.token}` };
  const contacts = (await fetch(`${api}/contacts`, { headers }).then((response) =>
    response.json(),
  )) as Array<{ id: string; user: { id: string } }>;
  const contact = contacts[0];
  if (!contact) throw new Error('The demo account has no seeded contact');
  await fetch(`${api}/contacts/${contact.id}/block`, {
    method: 'PUT',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ is_blocked: false }),
  });
  const conversation = (await fetch(`${api}/conversations/direct`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ user_id: contact.user.id }),
  }).then((response) => response.json())) as { id: string };
  return conversation.id;
}

test('contact picker and profile panel are mutually exclusive and picker actions close it', async ({
  browser,
}) => {
  const auth = await session();
  const { context, page } = await signedInPage(browser, { width: 1280, height: 900 }, auth);
  await page.goto('/');
  await page.getByRole('button', { name: 'New chat' }).click();
  const picker = page.getByRole('dialog', { name: 'New message' });
  await expect(picker).toBeVisible();
  const avatar = picker.locator('[aria-label^="Open "][aria-label$=" profile"]').first();
  await avatar.click();
  await expect(picker).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Profile' })).toBeVisible();
  await expect(page.locator('.modal-backdrop:visible, .side-panel-backdrop:visible')).toHaveCount(
    1,
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Profile' })).toHaveCount(0);

  await page.getByRole('button', { name: 'New chat' }).click();
  const nextPicker = page.getByRole('dialog', { name: 'New message' });
  await nextPicker.locator('.contact-picker-row').first().click();
  await expect(nextPicker).toHaveCount(0);
  await expect(page.locator('.chat-header')).toBeVisible();
  await expect(page.locator('.modal-backdrop:visible, .side-panel-backdrop:visible')).toHaveCount(
    0,
  );
  await context.close();
});

test('Escape closes a confirmation before its containing info panel', async ({ browser }) => {
  const auth = await session();
  const conversationId = await directConversation(auth);
  const { context, page } = await signedInPage(browser, { width: 1280, height: 900 }, auth);
  await page.goto(`/chat/${conversationId}`);
  await page.getByRole('button', { name: /Open .* info/ }).click();
  const info = page.getByRole('dialog', { name: 'Conversation info' });
  await expect(info).toBeVisible();
  await info.getByRole('button', { name: 'Block' }).click();
  const confirmation = page.getByRole('dialog', { name: 'Block contact?' });
  await expect(confirmation).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(confirmation).toHaveCount(0);
  await expect(info).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(info).toHaveCount(0);
  await expect(page.locator('.modal-backdrop:visible, .side-panel-backdrop:visible')).toHaveCount(
    0,
  );
  await context.close();
});

test('block toasts use the top viewport without covering the blocked banner or panel close button', async ({
  browser,
}) => {
  const auth = await session();
  const conversationId = await directConversation(auth);
  for (const width of [375, 768, 1280]) {
    for (const keepPanelOpen of [true, false]) {
      const { context, page } = await signedInPage(browser, { width, height: 900 }, auth);
      await page.goto(`/chat/${conversationId}`);
      await page.getByRole('button', { name: /Open .* info/ }).click();
      const info = page.getByRole('dialog', { name: 'Conversation info' });
      await info.getByRole('button', { name: 'Block' }).click();
      await page.getByRole('button', { name: 'Confirm block' }).click();
      const toast = page.getByRole('status').filter({ hasText: 'Contact blocked.' });
      await expect(toast).toBeVisible();
      const bar = page.locator('.blocked-composer');
      await expect(bar).toBeVisible();
      if (!keepPanelOpen) {
        await info.getByRole('button', { name: width < 768 ? 'Back' : 'Close panel' }).click();
        await expect(info).toHaveCount(0);
      }
      const toastBox = await toast.boundingBox();
      const barBox = await bar.boundingBox();
      expect(toastBox).toBeTruthy();
      expect(barBox).toBeTruthy();
      expect(toastBox!.y).toBeGreaterThanOrEqual(72);
      expect(toastBox!.y).toBeLessThanOrEqual(144);
      expect(
        toastBox!.y + toastBox!.height <= barBox!.y || barBox!.y + barBox!.height <= toastBox!.y,
      ).toBeTruthy();
      if (keepPanelOpen && width === 1280) {
        const panelBox = await info.boundingBox();
        expect(panelBox).toBeTruthy();
        const closeBox = await info.getByRole('button', { name: 'Close panel' }).boundingBox();
        expect(closeBox).toBeTruthy();
        expect(
          toastBox!.y + toastBox!.height <= closeBox!.y ||
            closeBox!.y + closeBox!.height <= toastBox!.y,
        ).toBeTruthy();
      }
      if (keepPanelOpen && width < 768) {
        const closeBox = await info.getByRole('button', { name: 'Back' }).boundingBox();
        expect(closeBox).toBeTruthy();
        expect(
          toastBox!.y + toastBox!.height <= closeBox!.y ||
            closeBox!.y + closeBox!.height <= toastBox!.y,
        ).toBeTruthy();
      }
      if (!keepPanelOpen) {
        const unblock = bar.getByRole('button', { name: 'Unblock' });
        await expect(unblock).toBeVisible();
        const unblockBox = await unblock.boundingBox();
        expect(unblockBox).toBeTruthy();
        expect(
          toastBox!.y + toastBox!.height <= unblockBox!.y ||
            unblockBox!.y + unblockBox!.height <= toastBox!.y,
        ).toBeTruthy();
        await unblock.click();
        await expect(page.getByText('Contact unblocked.')).toBeVisible();
      } else {
        await page.getByRole('button', { name: 'Undo' }).click();
      }
      await context.close();
      // Avoid a stale query cache when the next viewport blocks the same demo contact.
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
});

test('opening each primary UI surface never leaves the picker visible beside it', async ({
  browser,
}) => {
  const auth = await session();
  const conversationId = await directConversation(auth);
  const conversations = (await fetch(`${api}/conversations`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  }).then((response) => response.json())) as Array<{ id: string; type: 'direct' | 'group' }>;
  const groupId = conversations.find((conversation) => conversation.type === 'group')?.id;
  expect(groupId).toBeTruthy();
  const { context, page } = await signedInPage(browser, { width: 1280, height: 900 }, auth);
  for (const [id, infoName] of [
    [conversationId, 'Conversation info'],
    [groupId!, 'Group info'],
  ] as const) {
    await page.goto(`/chat/${id}`);
    await page.getByRole('button', { name: 'New chat' }).click();
    const picker = page.getByRole('dialog', { name: 'New message' });
    await expect(page.locator('.modal-backdrop:visible, .side-panel-backdrop:visible')).toHaveCount(
      1,
    );
    await page
      .locator('.chat-identity-button')
      .evaluate((button: HTMLButtonElement) => button.click());
    await expect(picker).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: infoName })).toBeVisible();
    await expect(page.locator('.modal-backdrop:visible, .side-panel-backdrop:visible')).toHaveCount(
      1,
    );
    await page.keyboard.press('Escape');
  }
  await context.close();
});
