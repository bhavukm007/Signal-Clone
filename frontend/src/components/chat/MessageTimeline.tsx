import { Check, CheckCheck, Clock3 } from 'lucide-react';
import { dayLabel, fullTime } from '@/lib/formatters';
import type { Message } from '@/types/models';
import { AuthenticatedAttachment } from '@/components/chat/AuthenticatedAttachment';

interface MessageTimelineProps {
  messages: Message[];
  conversationType: 'direct' | 'group';
  currentUserId?: string;
  onReply: (messageId: string) => void;
  onReact: (messageId: string, emoji: string) => void;
  onRemoveReaction: (messageId: string) => void;
  onPreviewAttachment: (url: string) => void;
}

export function MessageTimeline({
  messages,
  conversationType,
  currentUserId,
  onReply,
  onReact,
  onRemoveReaction,
  onPreviewAttachment,
}: MessageTimelineProps) {
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
              >
                <div className="bubble">
                  {conversationType === 'group' && incoming && !grouped && (
                    <b className="group-sender" style={{ color: message.sender.avatar_color }}>
                      {message.sender.display_name}
                    </b>
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
                <button className="reply-action" aria-label="Reply" onClick={() => onReply(message.id)}>
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
              </article>
            )}
          </div>
        );
      })}
    </>
  );
}
