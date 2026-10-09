import { expect, test, type Browser } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const api = `${process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:8000'}/api/v1`;
const viewports = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
];

async function chatPage(
  browser: Browser,
  viewport: (typeof viewports)[number],
  token: string,
  user: object,
) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.addInitScript(
    (auth) => localStorage.setItem('signal-auth', JSON.stringify({ state: auth, version: 0 })),
    { token, user },
  );
  return { context, page };
}

test('chat panes wrap long unbroken content without horizontal overflow at target widths', async ({
  browser,
}) => {
  const first = await fetch(`${api}/auth/request-otp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: '+919000000001' }),
  });
  expect(first.ok).toBeTruthy();
  const auth = await fetch(`${api}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: '+919000000001', code: '123456' }),
  });
  const session = (await auth.json()) as { token: string; user: object };
  const chats = await fetch(`${api}/conversations`, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  const conversations = (await chats.json()) as Array<{ id: string }>;
  for (const viewport of viewports) {
    const { context, page } = await chatPage(browser, viewport, session.token, session.user);
    await page.goto(`/chat/${conversations[0]?.id}`);
    const longText = `unbroken-${'signal'.repeat(200)}-${randomUUID()}`;
    await page.getByPlaceholder('Write a message…').fill(longText);
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.locator('.message-list').getByText(longText)).toBeVisible();
    const dimensions = await page.evaluate(() => {
      // Message action buttons are positioned outside their message row on desktop.
      // The pane and bubble content are the actual scroll containers that must fit.
      const selectors = ['.app-main', '.chat-view', '.message-list', '.bubble'];
      return selectors.flatMap((selector) =>
        [...document.querySelectorAll<HTMLElement>(selector)]
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              selector,
              clientWidth: element.clientWidth,
              scrollWidth: element.scrollWidth,
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              children: [...element.children].map((child) => {
                const node = child as HTMLElement;
                return {
                  tag: node.tagName,
                  id: node.id,
                  className: node.className,
                  clientWidth: node.clientWidth,
                  scrollWidth: node.scrollWidth,
                  overflowWrap: getComputedStyle(node).overflowWrap,
                  whiteSpace: getComputedStyle(node).whiteSpace,
                };
              }),
            };
          })
          .filter(
            (item) =>
              item.scrollWidth > item.clientWidth + 1 ||
              item.left < 0 ||
              item.right > window.innerWidth + 1,
          ),
      );
    });
    expect(
      dimensions.every((item) => item.scrollWidth <= item.clientWidth + 1),
      JSON.stringify(dimensions),
    ).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      viewport.width + 1,
    );
    await context.close();
  }
});
