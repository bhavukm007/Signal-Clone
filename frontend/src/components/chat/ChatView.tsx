'use client';
import { useCallback, useEffect, useRef, useState, type UIEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Search, ShieldCheck, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useMessages } from '@/hooks/useMessages';
import { useConversationDetails } from '@/hooks/useConversationDetails';
import { useMessageActions } from '@/hooks/useMessageActions';
import { useTyping } from '@/hooks/useTyping';
import { EMPTY_TYPING_LIST, useChatStore } from '@/store/chatStore';
import { useUiStore } from '@/store/uiStore';
import { usePresenceStore } from '@/store/presenceStore';
import { useAuthStore } from '@/store/authStore';
import type { Attachment } from '@/types/models';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { MessageTimeline } from '@/components/chat/MessageTimeline';
import { MessageComposer } from '@/components/chat/MessageComposer';
import { contactApi } from '@/lib/chatApi';

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
  const { react, removeReaction, removeMessage, upload } = useMessageActions(conversationId);
  const queryClient = useQueryClient();
  const typingIds = useChatStore(
    (s) => s.typingByConversation[conversationId] ?? EMPTY_TYPING_LIST,
  );
  const presence = usePresenceStore((s) => s.onlineUserIds);
  const lastSeenAtByUser = usePresenceStore((s) => s.lastSeenAtByUser);
  const [draft, setDraft] = useState('');
  const [reply, setReply] = useState<string | null>(null);
  const [showLatest, setShowLatest] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
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
  const blocked = Boolean(conversation.is_blocked_by_me || conversation.is_blocked_by_peer);
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
    sendMessage(draft.trim(), reply ?? undefined, pendingAttachments);
    setDraft('');
    setReply(null);
    setPendingAttachments([]);
    typing('');
  }
  return (
    <section className="chat-view">
      <ChatHeader
        title={title}
        peer={peer}
        online={peer ? (presence[peer.id] ?? peer.is_online) : false}
        lastSeenAt={peer ? (lastSeenAtByUser[peer.id] ?? peer.last_seen_at) : undefined}
        conversationType={conversation.type}
        memberCount={participants.length}
        onBack={() => {
          if (Number(window.history.state?.idx ?? 0) > 0) router.back();
          else router.replace('/');
        }}
        onSearch={() => setSearchOpen((value) => !value)}
      />
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
          {conversation.is_blocked_by_me
            ? 'You blocked this contact.'
            : 'This contact blocked you.'}
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
          onDelete={removeMessage}
          onPreviewAttachment={(attachmentId) =>
            useUiStore.getState().openAttachmentViewer({ conversationId, attachmentId })
          }
          onOpenProfile={(profileUser) => useUiStore.getState().openProfile(profileUser)}
        />
        {typingIds.length > 0 && (
          <div className="typing-indicator">
            <i />
            <i />
            <i /> typing
          </div>
        )}
        <div ref={bottom} />
      </div>
      {showLatest && (
        <button
          className="scroll-latest"
          onClick={() => bottom.current?.scrollIntoView({ behavior: 'smooth' })}
        >
          ↓ Latest messages
        </button>
      )}
      {conversation.is_blocked_by_me ? (
        <div className="blocked-composer" role="status">
          <span>You blocked this contact.</span>
          <button
            onClick={async () => {
              if (!peer) return;
              try {
                await contactApi.setBlocked(peer.id, false);
                await Promise.all([
                  queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] }),
                  queryClient.invalidateQueries({ queryKey: ['contacts'] }),
                  queryClient.invalidateQueries({ queryKey: ['conversations'] }),
                ]);
                useUiStore.getState().notify('Contact unblocked.', {
                  label: 'Undo',
                  run: () => {
                    void contactApi
                      .setBlocked(peer.id, true)
                      .then(() =>
                        Promise.all([
                          queryClient.invalidateQueries({
                            queryKey: ['conversation', conversationId],
                          }),
                          queryClient.invalidateQueries({ queryKey: ['contacts'] }),
                          queryClient.invalidateQueries({ queryKey: ['conversations'] }),
                        ]),
                      )
                      .catch(() =>
                        useUiStore.getState().notify('Contact could not be blocked again.'),
                      );
                  },
                });
              } catch {
                useUiStore.getState().notify('Contact could not be unblocked.');
              }
            }}
          >
            Unblock
          </button>
        </div>
      ) : blocked ? (
        <div className="blocked-composer" role="status">
          This contact blocked you. Messages are paused.
        </div>
      ) : (
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
      )}
    </section>
  );
}
