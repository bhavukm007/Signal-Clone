import { useEffect, useMemo, useRef } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { messageApi } from '@/lib/chatApi';
import { useAuthStore } from '@/store/authStore';
import { EMPTY_MESSAGE_LIST, useChatStore } from '@/store/chatStore';
import { useUiStore } from '@/store/uiStore';
import type { Message } from '@/types/models';
import type { SendEvent } from '@/hooks/useWebSocket';
import { usePreferencesStore } from '@/store/preferencesStore';

export function useMessages(conversationId: string, sendEvent: SendEvent) {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const storeMessages = useChatStore(
    (state) => state.messagesByConversation[conversationId] ?? EMPTY_MESSAGE_LIST,
  );
  const setMessages = useChatStore((state) => state.setMessages);
  const addMessage = useChatStore((state) => state.addMessage);
  const setActiveConversation = useChatStore((state) => state.setActiveConversation);
  const notify = useUiStore((state) => state.notify);
  const readReceipts = usePreferencesStore((state) => state.readReceipts);
  const lastReadId = useRef<string | null>(null);
  const query = useInfiniteQuery({
    queryKey: ['messages', conversationId],
    queryFn: ({ pageParam }) => messageApi.list(conversationId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => (page.length === 30 ? page[0]?.id : undefined),
    enabled: Boolean(conversationId),
  });
  const history = useMemo(() => [...(query.data?.pages ?? [])].reverse().flat(), [query.data]);

  useEffect(() => {
    setActiveConversation(conversationId);
    if (history.length) setMessages(conversationId, history);
    return () => setActiveConversation(null);
  }, [conversationId, history, setMessages, setActiveConversation]);

  const send = useMutation({
    mutationFn: (input: { body: string; replyToId?: string; attachmentIds?: string[] }) => {
      if (!user) throw new Error('Your session has expired. Please sign in again.');
      const clientMessageId = crypto.randomUUID();
      const optimistic: Message = {
        id: clientMessageId,
        conversation_id: conversationId,
        sender_id: user.id,
        sender: user,
        body: input.body,
        type: input.attachmentIds?.length ? 'file' : 'text',
        client_message_id: clientMessageId,
        created_at: new Date().toISOString(),
        edited_at: null,
        deleted_at: null,
        expires_at: null,
        reply_to_id: input.replyToId ?? null,
        status: 'sending',
        attachments: [],
        optimistic: true,
      };
      addMessage(optimistic);
      return messageApi
        .send(conversationId, input.body, clientMessageId, input.replyToId, input.attachmentIds)
        .then((message) => ({ message, clientMessageId }));
    },
    onSuccess: ({ message, clientMessageId }) => {
      useChatStore.getState().acknowledgeMessage(clientMessageId, message.id);
      void queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error) => {
      notify(error instanceof Error ? error.message : 'Message could not be sent.');
      void queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
    },
  });

  const uniqueMessages = useMemo(() => {
    const map = new Map<string, Message>();
    for (const message of [...history, ...storeMessages]) map.set(message.id, message);
    return Array.from(map.values()).sort((a, b) => a.created_at.localeCompare(b.created_at));
  }, [history, storeMessages]);

  useEffect(() => {
    const latestId = [...uniqueMessages]
      .reverse()
      .find((message) => message.sender_id !== user?.id && !message.optimistic)?.id;
    if (!latestId || !readReceipts || latestId === lastReadId.current) return;
    lastReadId.current = latestId;
    void messageApi
      .markRead(conversationId, latestId)
      .then(() => queryClient.invalidateQueries({ queryKey: ['conversations'] }));
    sendEvent('conversation.read', {
      conversation_id: conversationId,
      up_to_message_id: latestId,
    });
  }, [conversationId, uniqueMessages, sendEvent, readReceipts, queryClient, user?.id]);

  return {
    messages: uniqueMessages,
    loading: query.isLoading,
    error: query.error,
    retryMessages: query.refetch,
    hasPrevious: query.hasNextPage,
    loadPrevious: query.fetchNextPage,
    sending: send.isPending,
    sendMessage: (body: string, replyToId?: string, attachmentIds?: string[]) =>
      send.mutate({ body, replyToId, attachmentIds }),
  };
}
