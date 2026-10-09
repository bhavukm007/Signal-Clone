import { expect, test } from '@playwright/test';
import { api, login, openChat } from './chatTestHelpers';

test('group member controls are admin-only and removal is confirmed', async ({ browser }) => {
  const admin = await login('+919000000001');
  const member = await login('+919000000002');
  const groupResponse = await fetch(`${api}/groups`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${admin.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Admin menu test', member_ids: [member.user.id] }),
  });
  expect(groupResponse.ok).toBeTruthy();
  const group = (await groupResponse.json()) as { id: string };

  const adminChat = await openChat(browser, admin, group.id);
  await adminChat.page.getByRole('button', { name: 'More options' }).click();
  const panel = adminChat.page.getByRole('dialog', { name: 'Group info' });
  await expect(panel).toBeVisible();
  const actions = panel.getByRole('button', { name: 'Member actions for Isha Kapoor' });
  await actions.click();
  const menu = panel.getByRole('menu', { name: 'Isha Kapoor actions' });
  await menu.getByRole('menuitem', { name: 'Remove from group' }).click();
  await expect(adminChat.page.getByRole('dialog', { name: 'Remove Isha Kapoor?' })).toBeVisible();
  await adminChat.page.keyboard.press('Escape');
  await expect(adminChat.page.getByRole('dialog', { name: 'Remove Isha Kapoor?' })).toBeHidden();
  await expect(panel).toBeVisible();
  await adminChat.context.close();

  const memberChat = await openChat(browser, member, group.id);
  await memberChat.page.getByRole('button', { name: 'More options' }).click();
  const memberPanel = memberChat.page.getByRole('dialog', { name: 'Group info' });
  await expect(memberPanel).toBeVisible();
  await expect(memberPanel.locator('.member-menu-trigger')).toHaveCount(0);
  await expect(memberPanel.getByRole('button', { name: 'Exit group' })).toBeVisible();
  await memberChat.context.close();
});
