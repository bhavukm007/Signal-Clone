import { apiRequest } from '@/lib/api';
import type { Attachment, Contact, Conversation, ConversationDetail, Message, User } from '@/types/models';

export const conversationApi = {
  list: (query = '') => apiRequest<Conversation[]>(`/conversations${query ? `?q=${encodeURIComponent(query)}` : ''}`),
  details: (id: string) => apiRequest<ConversationDetail>(`/conversations/${id}`),
  direct: (user_id: string) => apiRequest<{ id: string; type: 'direct' }>('/conversations/direct', {
    method: 'POST', body: JSON.stringify({ user_id }),
  }),
  patch: (id: string, values: Record<string, string | number | boolean | null>) =>
    apiRequest(`/conversations/${id}`, { method: 'PATCH', body: JSON.stringify(values) }),
  createGroup: (name: string, member_ids: string[]) => apiRequest<{ id: string; title: string }>('/groups', {
    method: 'POST', body: JSON.stringify({ name, member_ids }),
  }),
  members: (id: string) => apiRequest<Array<{ user: User; role: 'admin' | 'member' }>>(`/groups/${id}/members`),
  addMembers: (id: string, user_ids: string[]) => apiRequest(`/groups/${id}/members`, {
    method: 'POST', body: JSON.stringify({ user_ids }),
  }),
  removeMember: (id: string, userId: string) => apiRequest(`/groups/${id}/members/${userId}`, { method: 'DELETE' }),
  setRole: (id: string, userId: string, role: 'admin' | 'member') => apiRequest(`/groups/${id}/members/${userId}/role`, {
    method: 'PATCH', body: JSON.stringify({ role }),
  }),
  updateGroup: (id: string, name: string, description: string) => apiRequest(`/groups/${id}`, {
    method: 'PATCH', body: JSON.stringify({ name, description }),
  }),
};

export const messageApi = {
  list: (id: string, before?: string) => apiRequest<Message[]>(
    `/conversations/${id}/messages?limit=30${before ? `&before=${encodeURIComponent(before)}` : ''}`,
  ),
  send: (id: string, body: string, client_message_id: string, reply_to_id?: string, attachment_ids?: string[]) =>
    apiRequest<Message>(`/conversations/${id}/messages`, {
      method: 'POST', body: JSON.stringify({ body, client_message_id, reply_to_id, attachment_ids }),
    }),
  markRead: (id: string, up_to_message_id: string) => apiRequest(`/conversations/${id}/read`, {
    method: 'POST', body: JSON.stringify({ up_to_message_id }),
  }),
  react: (id: string, emoji: string) => apiRequest(`/messages/${id}/reaction`, {
    method: 'PUT', body: JSON.stringify({ emoji }),
  }),
  removeReaction: (id: string) => apiRequest(`/messages/${id}/reaction`, { method: 'DELETE' }),
  remove: (id: string) => apiRequest(`/messages/${id}`, { method: 'DELETE' }),
};

export const contactApi = {
  list: () => apiRequest<Contact[]>('/contacts'),
  add: (identifier: string) => apiRequest<Contact>('/contacts', {
    method: 'POST', body: JSON.stringify({ identifier }),
  }),
  remove: (id: string) => apiRequest(`/contacts/${id}`, { method: 'DELETE' }),
  block: (id: string) => apiRequest(`/contacts/${id}/block`, { method: 'POST' }),
  search: (query: string) => apiRequest<User[]>(`/users/search?q=${encodeURIComponent(query)}`),
};

export const uploadApi = {
  upload: (file: File) => {
    const form = new FormData();
    form.set('file', file);
    return apiRequest<Attachment>('/uploads', { method: 'POST', body: form });
  },
};
