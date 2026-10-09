import type { QueryClient } from '@tanstack/react-query';
import { messagePreviewText } from '@/lib/formatters';
import type { Conversation, Message } from '@/types/models';

export function updateConversationPreview(queryClient: QueryClient, message: Message): void {
  queryClient.setQueriesData<Conversation[]>({ queryKey: ['conversations'] }, (conversations) => {
    if (!conversations) return conversations;
    const next = conversations.map((conversation) => {
      if (conversation.id !== message.conversation_id) return conversation;
      return {
        ...conversation,
        last_activity_at: message.created_at,
        last_message: {
          id: message.id,
          sender_id: message.sender_id,
          sender: message.sender,
          body: message.body,
          preview_text: messagePreviewText(message.body, message.attachments),
          type: message.type,
          created_at: message.created_at,
        },
      };
    });
    return next.sort(
      (left, right) =>
        Number(right.is_pinned) - Number(left.is_pinned) ||
        Date.parse(right.last_activity_at) - Date.parse(left.last_activity_at),
    );
  });
}
