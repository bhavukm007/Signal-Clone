import {
  expect,
  type Browser,
  type BrowserContext,
  type Page,
  type WebSocket,
} from '@playwright/test';
import { randomUUID } from 'node:crypto';

export const api = `${process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:8000'}/api/v1`;

export function phone() {
  return `+91 7${randomUUID().replace(/\D/g, '').padEnd(9, '0').slice(0, 9)}`;
}

export async function login(identifier: string) {
  const request = async (path: string, body: object) => {
    const response = await fetch(`${api}/auth/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Auth ${path} failed: ${response.status}`);
    return response.json();
  };
  await request('request-otp', { identifier });
  const session = (await request('verify-otp', { identifier, code: '123456' })) as {
    token: string;
    user: { id: string; display_name: string; last_seen_at: string };
  };
  if (!session.user.display_name) {
    const response = await fetch(`${api}/auth/profile`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${session.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ display_name: `Local ${randomUUID().slice(0, 8)}` }),
    });
    if (!response.ok) throw new Error(`Profile setup failed: ${response.status}`);
    session.user = await response.json();
  }
  return session;
}

export async function createDirect(alice: Awaited<ReturnType<typeof login>>, bobId: string) {
  const response = await fetch(`${api}/conversations/direct`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${alice.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ user_id: bobId }),
  });
  if (!response.ok) throw new Error(`Direct chat creation failed: ${response.status}`);
  return (await response.json()) as { id: string };
}

export async function openChat(
  browser: Browser,
  session: Awaited<ReturnType<typeof login>>,
  conversationId: string,
  onWebSocket?: (socket: WebSocket) => void,
): Promise<{ context: BrowserContext; page: Page; socket: WebSocket }> {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    timezoneId: 'Asia/Kolkata',
  });
  await context.addInitScript(({ token, user }) => {
    localStorage.setItem('signal-auth', JSON.stringify({ state: { token, user }, version: 0 }));
    localStorage.setItem('signal-ui', JSON.stringify({ state: { theme: 'light' }, version: 0 }));
  }, session);
  const page = await context.newPage();
  if (onWebSocket) page.on('websocket', onWebSocket);
  const socket = page.waitForEvent('websocket');
  await page.goto(`/chat/${conversationId}`);
  await expect(page.locator('.message-list')).toBeVisible();
  return { context, page, socket: await socket };
}
