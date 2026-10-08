export const OTP_HINT = 'Use 123456';
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';
const apiOrigin = apiUrl.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
const websocketOrigin = apiOrigin.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? `${websocketOrigin}/ws`;
export const MESSAGE_PAGE_SIZE = 30;
