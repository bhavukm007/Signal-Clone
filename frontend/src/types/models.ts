export interface User {
  id: string;
  phone_number: string | null;
  username: string | null;
  display_name: string;
  about: string;
  avatar_url: string | null;
  avatar_color: string;
  is_online: boolean;
  last_seen_at: string;
}

export interface Attachment {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  url: string;
}

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';
export type MessageType = 'text' | 'image' | 'file' | 'system';

export interface MessagePreview {
  id: string;
  sender_id: string;
  sender: User;
  body: string;
  type: MessageType;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender: User;
  body: string;
  type: MessageType;
  client_message_id: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  expires_at: string | null;
  reply_to_id: string | null;
  status: MessageStatus;
  attachments: Attachment[];
  optimistic?: boolean;
  reactions?: Array<{ emoji: string; count: number; user_ids: string[] }>;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  title: string;
  description?: string | null;
  participants: User[];
  last_message: MessagePreview | null;
  last_activity_at: string;
  unread_count: number;
  is_pinned: boolean;
  muted_until: string | null;
  is_online: boolean;
  last_seen_at?: string | null;
  avatar_color: string;
  disappearing_timer_seconds?: number | null;
}

export interface ConversationDetail extends Omit<Conversation, 'participants'> {
  participants: Array<{ user: User; role: 'admin' | 'member' }>;
  is_blocked_by_me?: boolean;
  is_blocked_by_peer?: boolean;
}

export interface Contact {
  id: string;
  user: User;
  nickname: string | null;
  is_blocked: boolean;
}
