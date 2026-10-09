import { useAuthStore } from '@/store/authStore';

const configuredUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';
export const API_BASE_URL = configuredUrl.replace(/\/$/, '');
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function handleExpiredSession(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(
    'signal-auth-notice',
    'Your session expired. Please sign in again.',
  );
  useAuthStore.getState().clearSession();
  window.dispatchEvent(new Event('signal-session-expired'));
}

const wakeupRetryDelays = [1000, 2000, 4000, 8000, 15000, 15000, 15000];

async function fetchWithWakeupRetry(
  url: string,
  init: RequestInit,
  onRetry?: () => void,
): Promise<Response> {
  for (let attempt = 0; ; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      const delay = wakeupRetryDelays[attempt];
      if (!onRetry || delay === undefined) throw error;
      onRetry();
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }

    const delay = wakeupRetryDelays[attempt];
    if (![502, 503, 504].includes(response.status) || !onRetry || delay === undefined)
      return response;
    onRetry();
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  onWakeupRetry?: () => void,
): Promise<T> {
  const headers = new Headers(init.headers);
  const token = useAuthStore.getState().token;
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!(init.body instanceof FormData) && init.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetchWithWakeupRetry(
    `${API_BASE_URL}${path}`,
    { ...init, headers },
    onWakeupRetry,
  );
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      error?: { code?: string; message?: string };
    } | null;
    if (response.status === 401 && token) handleExpiredSession();
    throw new ApiError(
      data?.error?.message ?? 'The request could not be completed.',
      response.status,
      data?.error?.code ?? 'REQUEST_ERROR',
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function fetchMedia(path: string, signal: AbortSignal): Promise<Blob> {
  const token = useAuthStore.getState().token;
  const url = path.startsWith('/api/v1/') ? `${API_ORIGIN}${path}` : `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    signal,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) {
    if (response.status === 401 && token) handleExpiredSession();
    throw new ApiError('Media could not be loaded.', response.status, 'MEDIA_ERROR');
  }
  return response.blob();
}

export function mediaUrl(path: string): string {
  return path.startsWith('http') ? path : `${API_ORIGIN}${path}`;
}
