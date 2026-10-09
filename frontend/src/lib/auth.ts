import { apiRequest } from '@/lib/api';
import type { User } from '@/types/models';

export interface AuthResult {
  token: string;
  user: User;
  is_new_user: boolean;
}

export const authApi = {
  requestOtp: (identifier: string, onWakeupRetry?: () => void) =>
    apiRequest<{ ok: boolean; demo_code: string }>(
      '/auth/request-otp',
      {
        method: 'POST',
        body: JSON.stringify({ identifier }),
      },
      onWakeupRetry,
    ),
  verifyOtp: (identifier: string, code: string, onWakeupRetry?: () => void) =>
    apiRequest<AuthResult>(
      '/auth/verify-otp',
      {
        method: 'POST',
        body: JSON.stringify({ identifier, code }),
      },
      onWakeupRetry,
    ),
  me: () => apiRequest<User>('/auth/me'),
  updateProfile: (display_name: string, about?: string) =>
    apiRequest<User>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ display_name, about }),
    }),
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.set('file', file);
    return apiRequest<{ avatar_url: string }>('/users/me/avatar', { method: 'POST', body: form });
  },
  removeAvatar: () => apiRequest<{ ok: boolean }>('/users/me/avatar', { method: 'DELETE' }),
  logout: () => apiRequest<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
};
