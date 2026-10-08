import { useQuery } from '@tanstack/react-query';
import { conversationApi, contactApi } from '@/lib/chatApi';
import { useDebounce } from './useDebounce';
import { useUiStore } from '@/store/uiStore';

export function useConversations(query?: string) {
  const search = useUiStore((state) => state.searchQuery);
  const debounced = useDebounce(query ?? search, 250);
  return useQuery({
    queryKey: ['conversations', debounced],
    queryFn: () => conversationApi.list(debounced),
    staleTime: 1500,
  });
}

export function useContacts() {
  return useQuery({ queryKey: ['contacts'], queryFn: contactApi.list, staleTime: 10000 });
}
