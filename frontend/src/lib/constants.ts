export const OTP_HINT = 'Use 123456';

export function resolveWebSocketUrl(apiUrl: string, configuredUrl?: string): string {
  if (configuredUrl) return configuredUrl;
  const apiOrigin = apiUrl.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
  const websocketOrigin = apiOrigin.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
  return `${websocketOrigin}/ws`;
}

export const WS_URL = resolveWebSocketUrl(
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1',
  process.env.NEXT_PUBLIC_WS_URL,
);
export const MESSAGE_PAGE_SIZE = 30;
