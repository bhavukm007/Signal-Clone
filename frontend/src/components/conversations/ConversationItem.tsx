'use client';
import Link from 'next/link';
import { BellOff, Timer } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import type { Conversation } from '@/types/models';
import { conversationTime } from '@/lib/formatters';
import { useUiStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { formatSystemMessage } from '@/lib/systemMessages';

export function ConversationItem({
  conversation,
  selected,
}: {
  conversation: Conversation;
  selected: boolean;
}) {
  const peer = conversation.participants[0];
  const currentUserId = useAuthStore((state) => state.user?.id);
  const title = conversation.title || peer?.display_name || 'Conversation';
  const preview =
    (conversation.last_message?.type === 'system'
      ? formatSystemMessage(
          conversation.last_message.body,
          conversation.last_message.system_data,
          currentUserId,
          conversation.last_message.sender.display_name,
        )
      : conversation.last_message?.preview_text || conversation.last_message?.body) ||
    'Start a conversation';
  const muted = Boolean(
    conversation.muted_until && new Date(conversation.muted_until).getTime() > Date.now(),
  );
  const time = conversation.last_activity_at ? conversationTime(conversation.last_activity_at) : '';
  const senderPrefix =
    conversation.type === 'group' &&
    conversation.last_message?.type !== 'system' &&
    conversation.last_message
      ? `${conversation.last_message.sender.display_name}: `
      : '';

  return (
    <div
      className={`conversation-item ${selected ? 'selected' : ''} ${conversation.unread_count ? 'unread' : ''}`}
    >
      <button
        className="conversation-avatar-trigger"
        aria-label={`Open ${title} profile`}
        onClick={() => peer && useUiStore.getState().openProfile(peer)}
      >
        <Avatar
          name={title}
          color={conversation.avatar_color}
          imageUrl={peer?.avatar_url}
          online={conversation.is_online}
        />
      </button>
      <Link className="conversation-copy" href={`/chat/${conversation.id}`}>
        <span className="conversation-title">
          <b>{title}</b>
          <time>{time}</time>
        </span>
        <span className="conversation-preview">
          {senderPrefix}
          {preview}
          {muted && <BellOff size={13} />}
          {conversation.disappearing_timer_seconds ? <Timer size={13} /> : null}
        </span>
      </Link>
      {conversation.unread_count > 0 && (
        <span className="unread-badge">{conversation.unread_count}</span>
      )}
    </div>
  );
}
