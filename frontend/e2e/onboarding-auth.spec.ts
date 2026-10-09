import { expect, test } from '@playwright/test';

test('phone onboarding canonicalizes input and verifies the server-provided demo code', async ({
  page,
}) => {
  let requestBody: { identifier?: string } = {};
  await page.route(/\/api\/v1\/auth\/request-otp(?:\?.*)?$/, async (route) => {
    requestBody = route.request().postDataJSON() as { identifier?: string };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, demo_code: '654321' }),
    });
  });
  await page.route(/\/api\/v1\/auth\/verify-otp(?:\?.*)?$/, async (route) => {
    expect(route.request().postDataJSON()).toEqual({ identifier: '+919000000001', code: '654321' });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        token: 'browser-test-token',
        user: { id: 'browser-test-user', display_name: '' },
        is_new_user: true,
      }),
    });
  });
  await page.goto('/register');
  const continueButton = page.getByRole('button', { name: 'Continue' });
  await expect(continueButton).toBeDisabled();
  const phone = page.getByLabel('Phone number');
  await phone.fill('5000000000');
  await expect(continueButton).toBeDisabled();
  await phone.fill('900000001');
  await expect(continueButton).toBeDisabled();
  await page.getByRole('button', { name: 'Use a username instead' }).click();
  const username = page.getByLabel('Username');
  await expect(continueButton).toBeDisabled();
  await username.fill('ab');
  await expect(continueButton).toBeDisabled();
  await username.fill('abc');
  await expect(continueButton).toBeEnabled();
  await page.getByRole('button', { name: 'Use a phone number instead' }).click();
  await expect(continueButton).toBeDisabled();
  for (const pasted of ['+91 90000 00001', '919000000001', '09000000001', '9000000001']) {
    await phone.fill(pasted);
    await expect(phone).toHaveValue('90000 00001');
    await expect(continueButton).toBeEnabled();
  }
  await continueButton.click();
  await expect(page).toHaveURL(/\/verify$/);
  expect(requestBody.identifier).toBe('+919000000001');
  await expect(page.getByText('Demo mode: no SMS is sent. Enter 654321.')).toBeVisible();
  await expect(page.locator('.otp-boxes input')).toHaveCount(6);
  const verifyButton = page.getByRole('button', { name: 'Continue' });
  await expect(verifyButton).toBeDisabled();
  for (const [index, digit] of [...'65432'].entries()) {
    await page.getByLabel(`Digit ${index + 1}`).fill(digit!);
  }
  await expect(verifyButton).toBeDisabled();
  await page.getByLabel('Digit 6').fill('1');
  await expect(page).toHaveURL(/\/profile$/);
});

test('profile Continue stays disabled until a 2–50 character name is valid', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'signal-auth',
      JSON.stringify({
        state: {
          token: 'profile-validation-token',
          user: { id: 'profile-user', display_name: '' },
        },
        version: 0,
      }),
    );
  });
  await page.route(/\/api\/v1\/auth\/me(?:\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'profile-user',
        phone_number: '+919000000001',
        username: null,
        display_name: '',
        about: '',
        avatar_url: null,
        avatar_color: '#8298c9',
        is_online: false,
        last_seen_at: null,
        created_at: '2026-01-01T00:00:00Z',
      }),
    }),
  );
  await page.goto('/profile');
  const name = page.getByLabel('Display name');
  const continueProfile = page.getByRole('button', { name: 'Continue to Signal' });
  await expect(name).toBeVisible();
  await expect(continueProfile).toBeDisabled();
  await name.fill('A');
  await expect(continueProfile).toBeDisabled();
  await name.fill('  Ava  ');
  await expect(page.locator('.character-counter')).toHaveText('3/50');
  await expect(continueProfile).toBeEnabled();
});

test('avatar upload failure preserves saved name and offers Continue without photo', async ({
  page,
}) => {
  await page.addInitScript(
    (token) =>
      localStorage.setItem(
        'signal-auth',
        JSON.stringify({
          state: { token, user: { id: 'user-one', display_name: '' } },
          version: 0,
        }),
      ),
    'profile-flow-token',
  );
  const user = {
    id: 'user-one',
    phone_number: '+919000000001',
    username: null,
    display_name: 'New name',
    about: '',
    avatar_url: null,
    avatar_color: '#8298c9',
    is_online: false,
    last_seen_at: null,
    created_at: '2026-01-01T00:00:00Z',
  };
  await page.route(/\/api\/v1\/auth\/me(?:\?.*)?$/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) }),
  );
  let savedName = '';
  await page.route(/\/api\/v1\/auth\/profile(?:\?.*)?$/, async (route) => {
    savedName = (route.request().postDataJSON() as { display_name: string }).display_name;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(user),
    });
  });
  await page.route(/\/api\/v1\/users\/me\/avatar(?:\?.*)?$/, (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
  );
  await page.goto('/profile');
  await page.getByLabel('Display name').fill('Maya Test');
  await page.locator('input[aria-label="Choose profile photo"]').setInputFiles({
    name: 'avatar.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p7sAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await page.getByRole('button', { name: 'Use photo' }).click();
  await page.getByRole('button', { name: 'Continue to Signal' }).click();
  await expect(page.getByText(/Your name is saved/u)).toBeVisible();
  expect(savedName).toBe('Maya Test');
  await page.getByRole('button', { name: 'Continue without photo' }).click();
  await expect(page).toHaveURL('/');
});
