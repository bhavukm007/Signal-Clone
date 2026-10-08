import { create } from 'zustand';
import type { Message } from '@/types/models';

interface ChatState {
  activeConversationId: string | null;
  messagesByConversation: Record<string, Message[]>;
  typingByConversation: Record<string, string[]>;
  setActiveConversation: (id: string | null) => void;
  setMessages: (id: string, messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessageStatus: (messageId: string, status: Message['status']) => void;
  acknowledgeMessage: (clientMessageId: string, messageId: string) => void;
  setTyping: (conversationId: string, userId: string, isTyping: boolean) => void;
  removeMessage: (messageId: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  activeConversationId: null,
  messagesByConversation: {},
  typingByConversation: {},
  setActiveConversation: (id) => set({ activeConversationId: id }),
  setMessages: (id, messages) => set((state) => ({
    messagesByConversation: { ...state.messagesByConversation, [id]: messages },
  })),
  addMessage: (message) => set((state) => {
    const current = state.messagesByConversation[message.conversation_id] ?? [];
    if (current.some((item) => item.id === message.id || item.client_message_id === message.client_message_id)) {
      return state;
    }
    return {
      messagesByConversation: {
        ...state.messagesByConversation,
        [message.conversation_id]: [...current, message],
      },
    };
  }),
  updateMessageStatus: (messageId, status) => set((state) => {
    const next = { ...state.messagesByConversation };
    for (const [conversationId, messages] of Object.entries(next)) {
      next[conversationId] = messages.map((message) =>
        message.id === messageId ? { ...message, status } : message,
      );
    }
    return { messagesByConversation: next };
  }),
  acknowledgeMessage: (clientMessageId, messageId) => set((state) => {
    const next = Object.fromEntries(Object.entries(state.messagesByConversation).map(([id, messages]) => [
      id,
      messages.map((message) => message.client_message_id === clientMessageId
        ? { ...message, id: messageId, status: 'sent' as const, optimistic: false }
        : message),
    ]));
    return { messagesByConversation: next };
  }),
  setTyping: (conversationId, userId, isTyping) => set((state) => {
    const current = state.typingByConversation[conversationId] ?? [];
    const next = isTyping
      ? Array.from(new Set([...current, userId]))
      : current.filter((id) => id !== userId);
    return { typingByConversation: { ...state.typingByConversation, [conversationId]: next } };
  }),
  removeMessage: (messageId) => set((state) => {
    const next = Object.fromEntries(Object.entries(state.messagesByConversation).map(([id, messages]) => [
      id, messages.filter((message) => message.id !== messageId),
    ]));
    return { messagesByConversation: next };
  }),
}));
