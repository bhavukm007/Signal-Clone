'use client';

import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
} from 'react';
import {
  Check,
  CheckCheck,
  Clock3,
  Copy,
  Download,
  Forward,
  MoreHorizontal,
  Reply,
  Trash2,
} from 'lucide-react';
import { dayLabel, fullTime } from '@/lib/formatters';
import type { Message, User } from '@/types/models';
import { AuthenticatedAttachment } from '@/components/chat/AuthenticatedAttachment';
import { Avatar } from '@/components/ui/Avatar';
import { downloadMedia } from '@/lib/downloadMedia';
import { useUiStore } from '@/store/uiStore';
import { useOverlayStore } from '@/store/overlayStore';
import { formatSystemMessage } from '@/lib/systemMessages';

const EmojiPicker = dynamic(() => import('@/components/chat/EmojiPicker'), { ssr: false });
const quickEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

interface MessageTimelineProps {
  messages: Message[];
  conversationType: 'direct' | 'group';
  currentUserId?: string;
  participants?: User[];
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
  participants = [],
  onReply,
  onReact,
  onRemoveReaction,
  onPreviewAttachment,
  onOpenProfile,
  onDelete,
}: MessageTimelineProps) {
  const [menuMessageId, setMenuMessageId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ left: 8, top: 8 });
  const [reactionMessageId, setReactionMessageId] = useState<string | null>(null);
  const [reactionPosition, setReactionPosition] = useState({ left: 8, top: 8 });
  const [pickerMessageId, setPickerMessageId] = useState<string | null>(null);
  const [pickerPosition, setPickerPosition] = useState({ left: 8, top: 8 });
  const [pressingMessageId, setPressingMessageId] = useState<string | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!reactionMessageId) return;
    document.querySelector<HTMLButtonElement>('.reaction-bar:not(.in-menu) button')?.focus();
  }, [reactionMessageId]);

  useEffect(() => {
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMenuMessageId(null);
      setReactionMessageId(null);
      setPickerMessageId(null);
    };
    const dismissOutside = (event: globalThis.MouseEvent) => {
      if (
        !(event.target instanceof Element) ||
        event.target.closest('.message-row, .message-overlay')
      )
        return;
      setMenuMessageId(null);
      setReactionMessageId(null);
      setPickerMessageId(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('click', dismissOutside);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('click', dismissOutside);
    };
  }, []);

  function clearPress() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
    setPressingMessageId(null);
  }

  function openMenu(messageId: string, x: number, y: number) {
    const menuWidth = Math.min(252, window.innerWidth - 16);
    const menuHeight = Math.min(390, window.innerHeight - 16);
    setMenuPosition({
      left: Math.max(8, Math.min(x, window.innerWidth - menuWidth - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - menuHeight - 8)),
    });
    setMenuMessageId(messageId);
    setReactionMessageId(null);
    setPickerMessageId(null);
  }

  function openMenuFromButton(event: MouseEvent<HTMLButtonElement>, messageId: string) {
    const rect = event.currentTarget.getBoundingClientRect();
    openMenu(messageId, rect.left, rect.top);
  }

  function openReactionsFromButton(event: MouseEvent<HTMLButtonElement>, messageId: string) {
    const rect = event.currentTarget.getBoundingClientRect();
    setReactionPosition({
      left: Math.max(8, Math.min(rect.left - 4, window.innerWidth - 304)),
      top: Math.max(8, Math.min(rect.top - 52, window.innerHeight - 52)),
    });
    setReactionMessageId(reactionMessageId === messageId ? null : messageId);
    setMenuMessageId(null);
    setPickerMessageId(null);
  }

  function openEmojiPicker(event: MouseEvent<HTMLButtonElement>, messageId: string) {
    const rect = event.currentTarget.getBoundingClientRect();
    setPickerPosition({
      left: Math.max(8, Math.min(rect.left - 270, window.innerWidth - 360)),
      top: Math.max(8, Math.min(rect.top - 360, window.innerHeight - 440)),
    });
    setPickerMessageId(messageId);
    setReactionMessageId(null);
    setMenuMessageId(null);
  }

  function toggleReaction(message: Message, emoji: string) {
    const ownReaction = message.reactions?.find((item) =>
      item.user_ids.includes(currentUserId ?? ''),
    );
    if (ownReaction?.emoji === emoji) onRemoveReaction(message.id);
    else onReact(message.id, emoji);
    setReactionMessageId(null);
    setPickerMessageId(null);
  }

  function openReactors(emoji: string, userIds: string[]) {
    const names = userIds.map((id) =>
      id === currentUserId
        ? 'You'
        : (participants.find((person) => person.id === id)?.display_name ?? 'Another participant'),
    );
    useOverlayStore.getState().push({
      kind: 'confirmation',
      title: `${emoji} reactions`,
      message: names.join(', ') || 'No reactions yet.',
    });
  }

  function moveInReactionBar(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (current < 0 || !buttons.length) return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    buttons[(current + direction + buttons.length) % buttons.length]?.focus();
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
        const menuOpen = menuMessageId === message.id;
        const quickOpen = reactionMessageId === message.id;
        const pickerOpen = pickerMessageId === message.id;

        return (
          <Fragment key={message.id}>
            {fresh && (
              <div className="date-divider">
                <span>{dayLabel(message.created_at)}</span>
              </div>
            )}
            {message.type === 'system' ? (
              <div className="system-message">
                {formatSystemMessage(
                  message.body,
                  message.system_data,
                  currentUserId,
                  message.sender.display_name,
                )}
              </div>
            ) : (
              <article
                className={`message-row ${incoming ? 'incoming' : 'outgoing'} ${grouped ? 'grouped' : ''} ${pressingMessageId === message.id ? 'long-pressing' : ''}`}
                onContextMenu={(event) => {
                  event.preventDefault();
                  openMenu(message.id, event.clientX, event.clientY);
                }}
                onTouchStart={(event) => {
                  const touch = event.touches[0];
                  touchStart.current = { x: touch.clientX, y: touch.clientY };
                  setPressingMessageId(message.id);
                  pressTimer.current = setTimeout(() => {
                    const point = touchStart.current;
                    if (point) openMenu(message.id, point.x, point.y);
                    setPressingMessageId(null);
                  }, 450);
                }}
                onTouchMove={(event) => {
                  const touch = event.touches[0];
                  if (touchStart.current && touch.clientX - touchStart.current.x > 25) clearPress();
                  if (
                    touchStart.current &&
                    Math.hypot(
                      touch.clientX - touchStart.current.x,
                      touch.clientY - touchStart.current.y,
                    ) > 14
                  )
                    clearPress();
                }}
                onTouchEnd={(event) => {
                  const wasLongPress = pressTimer.current === null && menuMessageId === message.id;
                  clearPress();
                  const touch = event.changedTouches[0];
                  if (
                    !wasLongPress &&
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
                        className={`ticks status-${message.status}`}
                        aria-label={
                          message.status === 'sending'
                            ? 'Sending'
                            : message.status === 'sent'
                              ? 'Sent'
                              : message.status === 'delivered'
                                ? 'Delivered'
                                : 'Read'
                        }
                        title={
                          message.status === 'sending'
                            ? 'Sending'
                            : message.status === 'sent'
                              ? 'Sent'
                              : message.status === 'delivered'
                                ? 'Delivered'
                                : 'Read'
                        }
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

                <div className="message-actions" aria-label="Message actions">
                  <button
                    className="message-action"
                    aria-label="Reply"
                    title="Reply"
                    onClick={() => onReply(message.id)}
                  >
                    <Reply size={17} />
                  </button>
                  <button
                    className="message-action"
                    aria-label="React"
                    title="React"
                    onClick={(event) => openReactionsFromButton(event, message.id)}
                  >
                    ☺
                  </button>
                  <button
                    className="message-action"
                    aria-label="More"
                    title="More"
                    onClick={(event) => openMenuFromButton(event, message.id)}
                  >
                    <MoreHorizontal size={18} />
                  </button>
                </div>

                {message.reactions && message.reactions.length > 0 && (
                  <div className="reaction-pills" aria-label="Reactions">
                    {message.reactions.map((reaction) => {
                      const own = reaction.user_ids.includes(currentUserId ?? '');
                      return (
                        <button
                          key={reaction.emoji}
                          className={`reaction-chip ${own ? 'is-own' : ''}`}
                          aria-label={`${reaction.emoji}, ${reaction.count} reactions`}
                          title={reaction.user_ids
                            .map((id) =>
                              id === currentUserId
                                ? 'You'
                                : (participants.find((person) => person.id === id)?.display_name ??
                                  'Another participant'),
                            )
                            .join(', ')}
                          onClick={() => openReactors(reaction.emoji, reaction.user_ids)}
                        >
                          {reaction.emoji} {reaction.count}
                        </button>
                      );
                    })}
                  </div>
                )}

                {quickOpen &&
                  typeof document !== 'undefined' &&
                  createPortal(
                    <ReactionBar
                      style={{ left: reactionPosition.left, top: reactionPosition.top }}
                      onKeyDown={moveInReactionBar}
                      onChoose={(emoji) => toggleReaction(message, emoji)}
                      onMore={(event) => openEmojiPicker(event, message.id)}
                    />,
                    document.body,
                  )}
                {pickerOpen &&
                  typeof document !== 'undefined' &&
                  createPortal(
                    <EmojiPicker
                      className="emoji-picker-in-message message-overlay"
                      style={{ left: pickerPosition.left, top: pickerPosition.top }}
                      onSelect={(emoji) => {
                        toggleReaction(message, emoji);
                        setMenuMessageId(null);
                      }}
                    />,
                    document.body,
                  )}

                {menuOpen &&
                  typeof document !== 'undefined' &&
                  createPortal(
                    <div
                      className="message-context-menu message-overlay"
                      role="menu"
                      aria-label="Message actions"
                      style={{ left: menuPosition.left, top: menuPosition.top }}
                    >
                      <ReactionBar
                        inMenu
                        onKeyDown={moveInReactionBar}
                        onChoose={(emoji) => {
                          toggleReaction(message, emoji);
                          setMenuMessageId(null);
                        }}
                        onMore={(event) => openEmojiPicker(event, message.id)}
                      />
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
                          setReactionMessageId(message.id);
                          setMenuMessageId(null);
                        }}
                      >
                        <span aria-hidden="true">☺</span>React
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
                      <button
                        role="menuitem"
                        onClick={() => {
                          useUiStore.getState().notify('Forward is coming soon.');
                          setMenuMessageId(null);
                        }}
                      >
                        <Forward size={17} />
                        Forward
                      </button>
                      {message.attachments[0] && (
                        <button
                          role="menuitem"
                          onClick={() => {
                            void downloadMedia(
                              message.attachments[0]!.url,
                              message.attachments[0]!.file_name,
                            ).catch(() =>
                              useUiStore
                                .getState()
                                .notify('The attachment could not be downloaded.'),
                            );
                            setMenuMessageId(null);
                          }}
                        >
                          <Download size={17} />
                          Download
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
                    </div>,
                    document.body,
                  )}
              </article>
            )}
          </Fragment>
        );
      })}
    </>
  );
}

function ReactionBar({
  onChoose,
  onMore,
  onKeyDown,
  inMenu = false,
  style,
}: {
  onChoose: (emoji: string) => void;
  onMore: (event: MouseEvent<HTMLButtonElement>) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  inMenu?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`reaction-bar message-overlay ${inMenu ? 'in-menu' : ''}`}
      style={style}
      role="toolbar"
      aria-label="Quick reactions"
      onKeyDown={onKeyDown}
    >
      {quickEmojis.map((emoji) => (
        <button
          type="button"
          key={emoji}
          aria-label={`React with emoji ${emoji}`}
          onClick={() => onChoose(emoji)}
        >
          {emoji}
        </button>
      ))}
      <button
        type="button"
        aria-label="More emoji"
        onClick={(event) => {
          event.stopPropagation();
          onMore(event);
        }}
      >
        +
      </button>
    </div>
  );
}
