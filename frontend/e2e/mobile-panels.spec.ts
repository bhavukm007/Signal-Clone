import { expect, test, devices } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { api, createDirect, login, phone } from './chatTestHelpers';

const profiles = [
  { label: 'iphone13-portrait', width: 390, height: 844, device: devices['iPhone 13'] },
  { label: 'iphone13-landscape', width: 844, height: 390, device: devices['iPhone 13'] },
  { label: 'pixel7-portrait', width: 412, height: 915, device: devices['Pixel 7'] },
  { label: 'pixel7-landscape', width: 915, height: 412, device: devices['Pixel 7'] },
  { label: '320px', width: 320, height: 640, device: devices['iPhone 13'] },
];

test('mobile profiles, safe layout, navigation, and touch interactions', async ({ browser }) => {
  test.setTimeout(360000);
  const alice = await login(phone());
  const bob = await login(phone());
  const direct = await createDirect(alice, bob.user.id);
  const response = await fetch(`${api}/conversations/${direct.id}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${alice.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      client_message_id: `mobile-${Date.now()}`,
      body: 'Mobile viewport check',
    }),
  });
  expect(response.ok).toBeTruthy();

  const output = join(process.cwd(), 'test-results', 'screenshots', 'mobile');
  await mkdir(output, { recursive: true });
  for (const profile of profiles) {
    for (const theme of ['light', 'dark'] as const) {
      const context = await browser.newContext({
        ...profile.device,
        viewport: { width: profile.width, height: profile.height },
        timezoneId: 'Asia/Kolkata',
      });
      await context.addInitScript(
        ({ token, user, theme: selectedTheme }) => {
          localStorage.setItem(
            'signal-auth',
            JSON.stringify({ state: { token, user }, version: 0 }),
          );
          localStorage.setItem(
            'signal-ui',
            JSON.stringify({ state: { theme: selectedTheme }, version: 0 }),
          );
        },
        { ...alice, theme },
      );
      const page = await context.newPage();
      await page.goto('/');
      await expect(page.locator('.conversation-sidebar')).toBeVisible();
      const compose = page.getByRole('button', {
        name: profile.width < 768 ? 'Compose' : 'New chat',
      });
      const composeBox = await compose.boundingBox();
      if (profile.width < 768) expect(composeBox).toMatchObject({ width: 56, height: 56 });
      expect(composeBox!.x).toBeGreaterThanOrEqual(0);
      expect(composeBox!.x + composeBox!.width).toBeLessThanOrEqual(profile.width);
      await page.screenshot({ path: join(output, `${profile.width}-${theme}-chat-list.png`) });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        profile.width,
      );

      await compose.click();
      const picker = page.getByRole('dialog', { name: 'New message' });
      await expect(picker).toBeVisible();
      const pickerBox = await picker.boundingBox();
      expect(pickerBox!.height).toBeLessThanOrEqual(profile.height);
      await page.screenshot({ path: join(output, `${profile.width}-${theme}-new-message.png`) });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        profile.width,
      );
      await page.keyboard.press('Escape');
      await expect(picker).toBeHidden();

      await page.goto(`/chat/${direct.id}`);
      await expect(page.locator('.message-list')).toBeVisible();
      await expect(page.locator('.message-list').getByText('Mobile viewport check')).toBeVisible();
      const composer = page.locator('.composer');
      await expect(composer).toBeVisible();
      for (const target of await page
        .locator(
          '.chat-header button:visible, .composer button:visible, .composer .attach-button:visible',
        )
        .all()) {
        const box = await target.boundingBox();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
      await page.screenshot({ path: join(output, `${profile.width}-${theme}-chat.png`) });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        profile.width,
      );
      await page.setViewportSize({
        width: profile.width,
        height: Math.max(360, profile.height - 260),
      });
      const composerBox = await composer.boundingBox();
      expect(composerBox).toBeTruthy();
      await expect
        .poll(async () => {
          const box = await composer.boundingBox();
          return box ? box.y + box.height : Number.POSITIVE_INFINITY;
        })
        .toBeLessThanOrEqual(Math.max(360, profile.height - 260));
      await page.setViewportSize({ width: profile.width, height: profile.height });

      const row = page.locator('.message-row').filter({ hasText: 'Mobile viewport check' }).first();
      await row.evaluate((element) => {
        const touch = (x: number, y: number) =>
          new Touch({ identifier: 1, target: element, clientX: x, clientY: y });
        element.dispatchEvent(
          new TouchEvent('touchstart', {
            bubbles: true,
            touches: [touch(30, 30)],
            changedTouches: [touch(30, 30)],
          }),
        );
      });
      await page.waitForTimeout(550);
      await expect(page.getByRole('menu', { name: 'Message actions' })).toBeVisible();
      const replyMenuItem = page.getByRole('menuitem', { name: 'Reply' });
      await replyMenuItem.focus();
      await replyMenuItem.press('Enter');
      await expect(page.getByText(/Replying to/)).toBeVisible();

      await page.getByRole('button', { name: /Open .* info/ }).click();
      const info = page.getByRole('dialog', { name: 'Conversation info' });
      await expect(info).toBeVisible();
      await page.screenshot({ path: join(output, `${profile.width}-${theme}-info.png`) });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        profile.width,
      );
      await page.keyboard.press('Escape');
      await expect(info).toBeHidden();

      await page.goto('/settings');
      await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
      await page.screenshot({ path: join(output, `${profile.width}-${theme}-settings.png`) });

      for (const width of [320, 360, 375, 390, 414, 768, 1024]) {
        await page.setViewportSize({ width, height: 780 });
        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(scrollWidth, `settings overflows at ${width}px`).toBeLessThanOrEqual(width);
      }
      await context.close();
    }
  }
});
