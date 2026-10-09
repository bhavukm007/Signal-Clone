import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { WS_URL } from '@/lib/constants';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { usePresenceStore } from '@/store/presenceStore';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useUiStore } from '@/store/uiStore';
import { WsClient } from '@/lib/ws';
import type { Message } from '@/types/models';
import type { WsFrame } from '@/types/ws';
import { updateConversationPreview } from '@/lib/conversationPreview';

export type SendEvent = (type: string, payload: Record<string, unknown>) => boolean;
const SocketContext = createContext<SendEvent>(() => false);
const typingExpiry = new Map<string, number>();

function applyEvent(frame: WsFrame, queryClient: ReturnType<typeof useQueryClient>): void {
  const chat = useChatStore.getState();
  const payload = frame.payload;
  if (frame.type === 'message.new') {
    const data = payload as { message: Message };
    chat.addMessage(data.message);
    updateConversationPreview(queryClient, data.message);
    const currentUserId = useAuthStore.getState().user?.id;
    const notificationsEnabled = usePreferencesStore.getState().messageNotifications;
    if (
      notificationsEnabled &&
      data.message.sender_id !== currentUserId &&
      chat.activeConversationId !== data.message.conversation_id
    ) {
      useUiStore
        .getState()
        .notify(
          `${data.message.sender.display_name}: ${data.message.body || 'Sent an attachment'}`,
        );
    }
    void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    void queryClient.invalidateQueries({ queryKey: ['messages', data.message.conversation_id] });
  } else if (frame.type === 'message.ack') {
    const ack = payload as { client_message_id: string; message_id: string };
    chat.acknowledgeMessage(ack.client_message_id, ack.message_id);
  } else if (frame.type === 'message.status') {
    const status = payload as { message_id: string; aggregate_status: Message['status'] };
    chat.updateMessageStatus(status.message_id, status.aggregate_status);
  } else if (frame.type === 'message.deleted') {
    chat.removeMessage(String(payload.message_id));
    const conversationId = String(payload.conversation_id ?? '');
    if (conversationId)
      void queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
    void queryClient.invalidateQueries({ queryKey: ['conversations'] });
  } else if (frame.type === 'typing') {
    const typing = payload as { conversation_id: string; user_id: string; is_typing: boolean };
    const key = `${typing.conversation_id}:${typing.user_id}`;
    const existing = typingExpiry.get(key);
    if (existing !== undefined) window.clearTimeout(existing);
    chat.setTyping(typing.conversation_id, typing.user_id, typing.is_typing);
    if (typing.is_typing) {
      typingExpiry.set(
        key,
        window.setTimeout(() => {
          useChatStore.getState().setTyping(typing.conversation_id, typing.user_id, false);
          typingExpiry.delete(key);
        }, 5000),
      );
    } else typingExpiry.delete(key);
  } else if (frame.type === 'presence.snapshot') {
    const snapshot = payload as {
      users: Array<{ user_id: string; is_online: boolean; last_seen_at?: string | null }>;
    };
    usePresenceStore.getState().setSnapshot(snapshot.users);
    void queryClient.invalidateQueries({ queryKey: ['conversations'] });
  } else if (frame.type === 'presence') {
    const presence = payload as {
      user_id: string;
      is_online: boolean;
      last_seen_at?: string | null;
    };
    usePresenceStore
      .getState()
      .setPresence(presence.user_id, presence.is_online, presence.last_seen_at);
    void queryClient.invalidateQueries({ queryKey: ['conversations'] });
  } else if (frame.type === 'conversation.updated') {
    void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    const conversationId = String(payload.conversation_id ?? '');
    if (conversationId)
      void queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
  } else if (frame.type === 'reaction.updated') {
    void queryClient.invalidateQueries({ queryKey: ['messages'] });
  } else if (frame.type === 'error') {
    window.dispatchEvent(
      new CustomEvent('signal-error', { detail: String(payload.message ?? 'Realtime error') }),
    );
  }
}

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  const client = useMemo(
    () =>
      token
        ? new WsClient(
            token,
            (frame) => applyEvent(frame, queryClient),
            () => {
              void queryClient.invalidateQueries({ queryKey: ['conversations'] });
              const active = useChatStore.getState().activeConversationId;
              if (active) void queryClient.invalidateQueries({ queryKey: ['messages', active] });
            },
            (state) => usePresenceStore.getState().setConnectionStatus(state),
            () => useAuthStore.getState().clearSession(),
          )
        : null,
    [token, queryClient],
  );

  useEffect(() => {
    client?.connect();
    return () => client?.dispose();
  }, [client]);

  const send = useMemo<SendEvent>(
    () => (type, payload) => client?.send(type, payload) ?? false,
    [client],
  );
  return <SocketContext.Provider value={send}>{children}</SocketContext.Provider>;
}

export function useWebSocket(): SendEvent {
  return useContext(SocketContext);
}
