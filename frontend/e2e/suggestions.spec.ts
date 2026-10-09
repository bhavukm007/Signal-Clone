import { expect, test } from '@playwright/test';
import { api, login, phone } from './chatTestHelpers';

test('empty conversation list shows suggestions and message starts a chat', async ({ browser }) => {
  const session = await login(phone());
  const headers = { Authorization: `Bearer ${session.token}` };
  const response = await fetch(`${api}/users/suggestions?limit=8`, { headers });
  expect(response.ok).toBeTruthy();
  const suggestions = (await response.json()) as Array<{ id: string; display_name: string }>;
  expect(suggestions.length).toBeGreaterThan(1);

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(({ token, user }) => {
    localStorage.setItem('signal-auth', JSON.stringify({ state: { token, user }, version: 0 }));
  }, session);
  const page = await context.newPage();
  await page.route('**/api/v1/conversations', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Start your first conversation' })).toBeVisible();
  const firstCard = page
    .locator('.suggestion-card')
    .filter({ hasText: suggestions[0]!.display_name });
  await expect(firstCard).toBeVisible();
  await expect(firstCard.getByText('+91 ••••• ••001')).toBeVisible();

  await page.getByRole('button', { name: 'New chat' }).click();
  const modal = page.getByRole('dialog', { name: 'New message' });
  await expect(modal.getByRole('region', { name: 'Suggested people' })).toBeVisible();
  await page.keyboard.press('Escape');
  await firstCard.getByRole('button', { name: 'Message' }).click();
  await expect(page).toHaveURL(/\/chat\//);
  await expect(page.locator('.chat-header')).toBeVisible();
  await context.close();
});
