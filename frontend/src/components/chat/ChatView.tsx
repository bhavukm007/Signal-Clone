'use client';
import { useCallback, useEffect, useRef, useState, type UIEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Phone,
  Video,
  MoreVertical,
  Search,
  Send,
  Smile,
  Paperclip,
  ShieldCheck,
  X,
} from 'lucide-react';
import Image from 'next/image';
import { format } from 'date-fns';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useMessages } from '@/hooks/useMessages';
import { useConversationDetails } from '@/hooks/useConversationDetails';
import { mediaUrl } from '@/lib/api';
import { dayLabel, fullTime } from '@/lib/formatters';
import { useMessageActions } from '@/hooks/useMessageActions';
import { useTyping } from '@/hooks/useTyping';
import { useChatStore } from '@/store/chatStore';
import { useUiStore } from '@/store/uiStore';
import { usePresenceStore } from '@/store/presenceStore';
import { useAuthStore } from '@/store/authStore';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import type { Attachment } from '@/types/models';

export function ChatView() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const sendEvent = useWebSocket();
  const { data: conversation } = useConversationDetails(conversationId);
  const { messages, loading, sendMessage, loadPrevious, hasPrevious } = useMessages(
    conversationId,
    sendEvent,
  );
  const { react, removeReaction, upload } = useMessageActions(conversationId);
  const typingIds = useChatStore((s) => s.typingByConversation[conversationId] ?? []);
  const presence = usePresenceStore((s) => s.onlineUserIds);
  const [draft, setDraft] = useState('');
  const [reply, setReply] = useState<string | null>(null);
  const [showLatest, setShowLatest] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const bottom = useRef<HTMLDivElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const firstPage = useRef(true);
  const wasAtBottom = useRef(true);
  const priorHeight = useRef<number | null>(null);
  const typing = useTyping(sendEvent, conversationId);
  useEffect(() => {
    const box = scroll.current;
    if (!box) return;
    if (priorHeight.current !== null) {
      box.scrollTop += box.scrollHeight - priorHeight.current;
      priorHeight.current = null;
    } else if (firstPage.current || wasAtBottom.current) {
      bottom.current?.scrollIntoView({ behavior: firstPage.current ? 'auto' : 'smooth' });
      firstPage.current = false;
      setShowLatest(false);
    }
  }, [messages.length]);
  const onScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      const box = event.currentTarget;
      const distance = box.scrollHeight - box.scrollTop - box.clientHeight;
      wasAtBottom.current = distance < 180;
      setShowLatest(distance >= 180);
      if (box.scrollTop < 30 && hasPrevious && !loading) {
        priorHeight.current = box.scrollHeight;
        void loadPrevious();
      }
    },
    [hasPrevious, loading, loadPrevious],
  );
  if (!conversation) return <div className="loading-screen">Loading conversation…</div>;
  const participants = conversation.participants.map((item) => item.user);
  const peer = participants.find((item) => item.id !== user?.id);
  const title = conversation.title || peer?.display_name || 'Conversation';
  const visibleMessages = searchText.trim()
    ? messages.filter((message) =>
        `${message.body} ${message.sender.display_name}`
          .toLowerCase()
          .includes(searchText.trim().toLowerCase()),
      )
    : messages;
  function submit() {
    if (!draft.trim() && !pendingAttachments.length) return;
    sendMessage(
      draft.trim(),
      reply ?? undefined,
      pendingAttachments.map((item) => item.id),
    );
    setDraft('');
    setReply(null);
    setPendingAttachments([]);
    typing('');
  }
  return (
    <section className="chat-view">
      <header className="chat-header">
        <button
          className="icon-button mobile-back"
          onClick={() => router.push('/')}
          aria-label="Back"
        >
          <ArrowLeft />
        </button>
        <Avatar
          name={title}
          color={peer?.avatar_color}
          imageUrl={peer?.avatar_url}
          online={peer ? (presence[peer.id] ?? false) : false}
        />
        <div className="chat-heading">
          <b>{title}</b>
          <small>
            {conversation.type === 'group'
              ? `${participants.length} members`
              : peer && (presence[peer.id] ?? false)
                ? 'online'
                : peer?.last_seen_at
                  ? `last seen ${format(new Date(peer.last_seen_at), 'MMM d, h:mm a')}`
                  : 'offline'}
          </small>
        </div>
        <button
          className="icon-button"
          aria-label="Voice call"
          onClick={() => useUiStore.getState().notify('Voice calls are coming soon.')}
        >
          <Phone />
        </button>
        <button
          className="icon-button"
          aria-label="Video call"
          onClick={() => useUiStore.getState().notify('Video calls are coming soon.')}
        >
          <Video />
        </button>
        <button
          className="icon-button"
          aria-label="Search messages"
          onClick={() => setSearchOpen((value) => !value)}
        >
          <Search />
        </button>
        <button
          className="icon-button"
          aria-label="More options"
          onClick={() => useUiStore.getState().openModal('conversation-info')}
        >
          <MoreVertical />
        </button>
      </header>
      <div className="encryption-banner">
        <ShieldCheck size={14} /> Messages are end-to-end encrypted{' '}
        <button
          onClick={() =>
            useUiStore.getState().notify('Safety number verification is a demo placeholder.')
          }
        >
          Learn more
        </button>
      </div>
      {searchOpen && (
        <label className="message-search">
          <Search size={16} />
          <input
            autoFocus
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search this conversation"
            aria-label="Search this conversation"
          />
          <button
            aria-label="Close message search"
            onClick={() => {
              setSearchOpen(false);
              setSearchText('');
            }}
          >
            <X size={16} />
          </button>
        </label>
      )}
      <div className="message-list" ref={scroll} onScroll={onScroll}>
        {loading && <p className="inline-loading">Loading messages…</p>}
        {visibleMessages.map((message, index) => {
          const prior = visibleMessages[index - 1];
          const grouped =
            prior?.sender_id === message.sender_id &&
            new Date(message.created_at).getTime() - new Date(prior.created_at).getTime() < 300000;
          const fresh =
            !prior ||
            new Date(prior.created_at).toDateString() !==
              new Date(message.created_at).toDateString();
          const incoming = message.sender_id !== user?.id;
          const replyMessage = message.reply_to_id
            ? visibleMessages.find((item) => item.id === message.reply_to_id)
            : undefined;
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
                    {conversation.type === 'group' && incoming && !grouped && (
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
                    {message.attachments.map((a) =>
                      a.mime_type.startsWith('image/') ? (
                        <button
                          className="image-attachment"
                          key={a.id}
                          onClick={() => setLightbox(mediaUrl(a.url))}
                        >
                          <Image
                            src={mediaUrl(a.url)}
                            alt={a.file_name}
                            width={360}
                            height={240}
                            unoptimized
                          />
                          <span>{a.file_name}</span>
                        </button>
                      ) : (
                        <a
                          className="file-attachment"
                          key={a.id}
                          href={mediaUrl(a.url)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          📎 {a.file_name}
                        </a>
                      ),
                    )}
                    <footer>
                      <time title={fullTime(message.created_at)}>
                        {fullTime(message.created_at)}
                      </time>
                      {!incoming && (
                        <span className={`ticks ${message.status === 'read' ? 'read' : ''}`}>
                          {message.status === 'sending'
                            ? '◷'
                            : message.status === 'sent'
                              ? '✓'
                              : message.status === 'delivered'
                                ? '✓✓'
                                : '✓✓'}
                        </span>
                      )}
                    </footer>
                  </div>
                  <button
                    className="reply-action"
                    aria-label="Reply"
                    onClick={() => setReply(message.id)}
                  >
                    ↩
                  </button>
                  <button
                    className="reaction-action"
                    aria-label="React with heart"
                    onClick={() =>
                      message.reactions?.some(
                        (item) => item.emoji === '❤️' && item.user_ids.includes(user?.id ?? ''),
                      )
                        ? removeReaction(message.id)
                        : react(message.id, '❤️')
                    }
                  >
                    ♡
                  </button>
                  {message.reactions?.map((r) => (
                    <span className="reaction-chip" key={r.emoji}>
                      {r.emoji} {r.count}
                    </span>
                  ))}
                </article>
              )}
            </div>
          );
        })}
        {typingIds.length > 0 && (
          <div className="typing-indicator">
            <i />
            <i />
            <i /> typing
          </div>
        )}
        <div ref={bottom} />
        {showLatest && (
          <button
            className="scroll-latest"
            onClick={() => bottom.current?.scrollIntoView({ behavior: 'smooth' })}
          >
            ↓ Latest messages
          </button>
        )}
      </div>
      <div className="composer-wrap">
        {reply && (
          <div className="reply-preview">
            <span>Replying to {messages.find((item) => item.id === reply)?.body || 'message'}</span>
            <button onClick={() => setReply(null)}>×</button>
          </div>
        )}
        {pendingAttachments.length > 0 && (
          <div className="attachment-staging">
            {pendingAttachments.map((item) => (
              <span key={item.id}>
                📎 {item.file_name}
                <button
                  aria-label={`Remove ${item.file_name}`}
                  onClick={() =>
                    setPendingAttachments((items) => items.filter((file) => file.id !== item.id))
                  }
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="composer">
          <div className="emoji-control">
            <button
              className="icon-button"
              aria-label="Emoji"
              onClick={() => setEmojiOpen((value) => !value)}
            >
              <Smile />
            </button>
            {emojiOpen && (
              <div className="emoji-popover">
                {['😀', '😂', '❤️', '👍', '🎉', '🙏', '🙂', '🔥'].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      setDraft((value) => `${value}${emoji}`);
                      setEmojiOpen(false);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
          <textarea
            value={draft}
            placeholder="Write a message…"
            rows={1}
            onChange={(e) => {
              setDraft(e.target.value);
              typing(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <label className="icon-button attach-button" aria-label="Attach file">
            <Paperclip />
            <input
              type="file"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const attachment = await upload(file);
                  if (attachment) setPendingAttachments((items) => [...items, attachment]);
                  e.target.value = '';
                }
              }}
            />
          </label>
          <button
            className="send-button"
            aria-label="Send"
            onClick={submit}
            disabled={!draft.trim() && !pendingAttachments.length}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
      {lightbox && (
        <Modal title="Image preview" onClose={() => setLightbox(null)}>
          <Image
            src={lightbox}
            alt="Attachment preview"
            width={960}
            height={720}
            unoptimized
            className="lightbox-image"
          />
        </Modal>
      )}
    </section>
  );
}
