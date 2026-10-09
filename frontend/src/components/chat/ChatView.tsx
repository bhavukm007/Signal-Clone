'use client';
import { useCallback, useEffect, useRef, useState, type UIEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Phone, Video, MoreVertical, Search, ShieldCheck, X } from 'lucide-react';
import Image from 'next/image';
import { format } from 'date-fns';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useMessages } from '@/hooks/useMessages';
import { useConversationDetails } from '@/hooks/useConversationDetails';
import { useMessageActions } from '@/hooks/useMessageActions';
import { useTyping } from '@/hooks/useTyping';
import { EMPTY_TYPING_LIST, useChatStore } from '@/store/chatStore';
import { useUiStore } from '@/store/uiStore';
import { usePresenceStore } from '@/store/presenceStore';
import { useAuthStore } from '@/store/authStore';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import type { Attachment } from '@/types/models';
import { useMediaObjectUrl } from '@/hooks/useMediaObjectUrl';
import { MessageTimeline } from '@/components/chat/MessageTimeline';
import { MessageComposer } from '@/components/chat/MessageComposer';

export function ChatView() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const sendEvent = useWebSocket();
  const conversationQuery = useConversationDetails(conversationId);
  const {
    data: conversation,
    isLoading: conversationLoading,
    error: conversationError,
    refetch: retryConversation,
  } = conversationQuery;
  const {
    messages,
    loading,
    error: messageError,
    retryMessages,
    sendMessage,
    loadPrevious,
    hasPrevious,
  } = useMessages(conversationId, sendEvent);
  const { react, removeReaction, upload } = useMessageActions(conversationId);
  const typingIds = useChatStore(
    (s) => s.typingByConversation[conversationId] ?? EMPTY_TYPING_LIST,
  );
  const presence = usePresenceStore((s) => s.onlineUserIds);
  const [draft, setDraft] = useState('');
  const [reply, setReply] = useState<string | null>(null);
  const [showLatest, setShowLatest] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const lightboxUrl = useMediaObjectUrl(lightbox);
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
  if (conversationLoading) return <div className="loading-screen">Loading conversation…</div>;
  if (conversationError || !conversation)
    return (
      <div className="error-state" role="alert">
        <p>{conversationError ? 'Conversation could not be loaded.' : 'Conversation not found.'}</p>
        <button onClick={() => void retryConversation()}>Retry</button>
      </div>
    );
  const blocked = conversation.is_blocked_by_me || conversation.is_blocked_by_peer;
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
      {blocked && (
        <div className="blocked-banner" role="status">
          Blocked{conversation.is_blocked_by_peer ? ' by this contact' : ''}. Messages and presence
          are paused.
        </div>
      )}
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
        {messageError && (
          <div className="error-state" role="alert">
            <p>Messages could not be loaded.</p>
            <button onClick={() => void retryMessages()}>Retry</button>
          </div>
        )}
        <MessageTimeline
          messages={visibleMessages}
          conversationType={conversation.type}
          currentUserId={user?.id}
          onReply={setReply}
          onReact={react}
          onRemoveReaction={removeReaction}
          onPreviewAttachment={setLightbox}
        />
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
      <MessageComposer
        draft={draft}
        onDraftChange={setDraft}
        onTyping={typing}
        onSubmit={submit}
        blocked={blocked}
        replyText={
          reply === null ? undefined : messages.find((item) => item.id === reply)?.body || ''
        }
        onClearReply={() => setReply(null)}
        attachments={pendingAttachments}
        onRemoveAttachment={(id) =>
          setPendingAttachments((items) => items.filter((item) => item.id !== id))
        }
        onUpload={async (file) => {
          const attachment = await upload(file);
          if (attachment) setPendingAttachments((items) => [...items, attachment]);
        }}
      />
      {lightbox && lightboxUrl && (
        <Modal title="Image preview" onClose={() => setLightbox(null)}>
          <Image
            src={lightboxUrl}
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
