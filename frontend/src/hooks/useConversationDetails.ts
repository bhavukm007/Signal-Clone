import { useQuery } from '@tanstack/react-query';
import { conversationApi } from '@/lib/chatApi';

export function useConversationDetails(id: string) {
  return useQuery({
    queryKey: ['conversation', id],
    queryFn: () => conversationApi.details(id),
    enabled: Boolean(id),
  });
}
