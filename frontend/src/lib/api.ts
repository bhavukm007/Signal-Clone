import { useAuthStore } from '@/store/authStore';

const configuredUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';
export const API_BASE_URL = configuredUrl.replace(/\/$/, '');
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1$/, '');

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = useAuthStore.getState().token;
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!(init.body instanceof FormData) && init.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    const data = await response.json().catch(() => null) as {
      error?: { code?: string; message?: string };
    } | null;
    throw new ApiError(
      data?.error?.message ?? 'The request could not be completed.',
      response.status,
      data?.error?.code ?? 'REQUEST_ERROR',
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function mediaUrl(path: string): string {
  return path.startsWith('http') ? path : `${API_ORIGIN}${path}`;
}
