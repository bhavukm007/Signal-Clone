import { Check, CheckCheck, Clock3, Copy, Download, Heart, Reply, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { dayLabel, fullTime } from '@/lib/formatters';
import type { Message } from '@/types/models';
import { AuthenticatedAttachment } from '@/components/chat/AuthenticatedAttachment';
import { Avatar } from '@/components/ui/Avatar';
import type { User } from '@/types/models';
import { downloadMedia } from '@/lib/downloadMedia';
import { useUiStore } from '@/store/uiStore';

interface MessageTimelineProps {
  messages: Message[];
  conversationType: 'direct' | 'group';
  currentUserId?: string;
  onReply: (messageId: string) => void;
  onReact: (messageId: string, emoji: string) => void;
  onRemoveReaction: (messageId: string) => void;
  onPreviewAttachment: (attachmentId: string) => void;
  onOpenProfile: (user: User) => void;
  onDelete: (messageId: string) => Promise<unknown>;
}

export function MessageTimeline({
  messages,
  conversationType,
  currentUserId,
  onReply,
  onReact,
  onRemoveReaction,
  onPreviewAttachment,
  onOpenProfile,
  onDelete,
}: MessageTimelineProps) {
  const [menuMessageId, setMenuMessageId] = useState<string | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuMessageId(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);
  function clearPress() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  }
  return (
    <>
      {messages.map((message, index) => {
        const prior = messages[index - 1];
        const grouped =
          prior?.sender_id === message.sender_id &&
          new Date(message.created_at).getTime() - new Date(prior.created_at).getTime() < 300000;
        const fresh =
          !prior ||
          new Date(prior.created_at).toDateString() !== new Date(message.created_at).toDateString();
        const incoming = message.sender_id !== currentUserId;
        const replyMessage = message.reply_to_id
          ? messages.find((item) => item.id === message.reply_to_id)
          : undefined;
        const hasOwnHeart = message.reactions?.some(
          (item) => item.emoji === '❤️' && item.user_ids.includes(currentUserId ?? ''),
        );
        return (
          <div key={message.id}>
            {fresh && (
              <div className="date-divider">
                <span>{dayLabel(message.created_at)}</span>
              </div>
            )}
            {message.type === 'system' ? (
              <div className="system-message">{message.body}</div>
            ) : (
              <article
                className={`message-row ${incoming ? 'incoming' : 'outgoing'} ${grouped ? 'grouped' : ''}`}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setMenuMessageId(message.id);
                }}
                onTouchStart={(event) => {
                  const touch = event.touches[0];
                  touchStart.current = { x: touch.clientX, y: touch.clientY };
                  pressTimer.current = setTimeout(() => setMenuMessageId(message.id), 500);
                }}
                onTouchMove={(event) => {
                  const touch = event.touches[0];
                  if (touchStart.current && touch.clientX - touchStart.current.x > 25) clearPress();
                }}
                onTouchEnd={(event) => {
                  clearPress();
                  const touch = event.changedTouches[0];
                  if (
                    touchStart.current &&
                    touch.clientX - touchStart.current.x > 72 &&
                    Math.abs(touch.clientY - touchStart.current.y) < 48
                  )
                    onReply(message.id);
                  touchStart.current = null;
                }}
                onTouchCancel={clearPress}
              >
                <div className="bubble">
                  {conversationType === 'group' && incoming && !grouped && (
                    <button
                      className="group-sender"
                      style={{ color: message.sender.avatar_color }}
                      aria-label={`Open ${message.sender.display_name} profile`}
                      onClick={() => onOpenProfile(message.sender)}
                    >
                      <Avatar
                        name={message.sender.display_name}
                        color={message.sender.avatar_color}
                        size="tiny"
                      />
                      {message.sender.display_name}
                    </button>
                  )}
                  {replyMessage && (
                    <button
                      className="quoted-reply"
                      onClick={() =>
                        document
                          .getElementById(`message-${replyMessage.id}`)
                          ?.scrollIntoView({ behavior: 'smooth' })
                      }
                    >
                      <b>{replyMessage.sender.display_name}</b>
                      <span>{replyMessage.body}</span>
                    </button>
                  )}
                  <div id={`message-${message.id}`}>{message.body}</div>
                  {message.attachments.map((attachment) => (
                    <AuthenticatedAttachment
                      key={attachment.id}
                      attachment={attachment}
                      onPreview={onPreviewAttachment}
                    />
                  ))}
                  <footer>
                    <time title={fullTime(message.created_at)}>{fullTime(message.created_at)}</time>
                    {!incoming && (
                      <span
                        className={`ticks ${message.status === 'read' ? 'read' : ''}`}
                        aria-label={`Message ${message.status}`}
                      >
                        {message.status === 'sending' ? (
                          <Clock3 size={13} />
                        ) : message.status === 'sent' ? (
                          <Check size={14} />
                        ) : (
                          <CheckCheck size={15} />
                        )}
                      </span>
                    )}
                  </footer>
                </div>
                <button
                  className="reply-action"
                  aria-label="Reply"
                  onClick={() => onReply(message.id)}
                >
                  ↩
                </button>
                <button
                  className="reaction-action"
                  aria-label="React with heart"
                  onClick={() =>
                    hasOwnHeart ? onRemoveReaction(message.id) : onReact(message.id, '❤️')
                  }
                >
                  ♡
                </button>
                {message.reactions?.map((reaction) => (
                  <span className="reaction-chip" key={reaction.emoji}>
                    {reaction.emoji} {reaction.count}
                  </span>
                ))}
                {menuMessageId === message.id && (
                  <div className="message-context-menu" role="menu" aria-label="Message actions">
                    <button
                      role="menuitem"
                      onClick={() => {
                        onReply(message.id);
                        setMenuMessageId(null);
                      }}
                    >
                      <Reply size={17} />
                      Reply
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => {
                        onReact(message.id, '❤️');
                        setMenuMessageId(null);
                      }}
                    >
                      <Heart size={17} />
                      React
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => {
                        void navigator.clipboard.writeText(message.body);
                        setMenuMessageId(null);
                      }}
                    >
                      <Copy size={17} />
                      Copy
                    </button>
                    {message.attachments[0] && (
                      <button
                        role="menuitem"
                        onClick={() => {
                          void downloadMedia(
                            message.attachments[0].url,
                            message.attachments[0].file_name,
                          ).catch(() =>
                            useUiStore.getState().notify('The attachment could not be downloaded.'),
                          );
                          setMenuMessageId(null);
                        }}
                      >
                        <Download size={17} />
                        Save
                      </button>
                    )}
                    {message.sender_id === currentUserId && (
                      <button
                        role="menuitem"
                        onClick={() => {
                          void onDelete(message.id).catch(() =>
                            useUiStore.getState().notify('Message could not be deleted.'),
                          );
                          setMenuMessageId(null);
                        }}
                      >
                        <Trash2 size={17} />
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </article>
            )}
          </div>
        );
      })}
    </>
  );
}
