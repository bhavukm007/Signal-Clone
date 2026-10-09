'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageCircle, Settings, Pencil, Phone, CirclePlay } from 'lucide-react';
import { UserAvatar } from '@/components/ui/Avatar';
import { useAuthStore } from '@/store/authStore';
import { useConversations } from '@/hooks/useConversations';
import { useUiStore } from '@/store/uiStore';
import { ConversationItem } from '@/components/conversations/ConversationItem';
import { SearchBar } from '@/components/conversations/SearchBar';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { contactApi, conversationApi, userApi } from '@/lib/chatApi';
import { useDebounce } from '@/hooks/useDebounce';
import { Avatar } from '@/components/ui/Avatar';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const open = () => useUiStore.getState().openModal('new-chat');
  const searchRef = useRef<HTMLInputElement>(null);
  const query = useUiStore((s) => s.searchQuery);
  const term = useDebounce(query, 250);
  const { data: conversations = [], isLoading, error, refetch } = useConversations();
  const suggestions = useQuery({
    queryKey: ['user-suggestions'],
    queryFn: () => userApi.suggestions(8),
    enabled: !isLoading && !error && conversations.length === 0,
  });
  const {
    data: people = [],
    error: peopleError,
    refetch: retryPeople,
  } = useQuery({
    queryKey: ['sidebar-people', term],
    queryFn: () => contactApi.search(term),
    enabled: term.trim().length > 1,
  });
  useKeyboardShortcuts({
    newChat: open,
    focusSearch: () => searchRef.current?.focus(),
    close: () => useUiStore.getState().openModal(null),
    nextConversation: (direction) => {
      const index = conversations.findIndex((item) => pathname === `/chat/${item.id}`);
      const next = conversations[(index + direction + conversations.length) % conversations.length];
      if (next) router.push(`/chat/${next.id}`);
    },
  });
  async function startChat(userId: string) {
    try {
      const conversation = await conversationApi.direct(userId);
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      router.push(`/chat/${conversation.id}`);
    } catch {
      useUiStore.getState().notify('Could not start this conversation.');
    }
  }
  async function messageSuggestion(userId: string) {
    try {
      await contactApi.addById(userId);
      await startChat(userId);
    } catch {
      useUiStore.getState().notify('Could not add this person.');
    }
  }
  async function addSuggestion(userId: string) {
    try {
      await contactApi.addById(userId);
      await queryClient.invalidateQueries({ queryKey: ['contacts'] });
      await suggestions.refetch();
      useUiStore.getState().notify('Contact added.');
    } catch {
      useUiStore.getState().notify('Could not add this person.');
    }
  }
  return (
    <aside className="sidebar">
      <nav className="nav-rail">
        <Link href="/" aria-label="Chats">
          <MessageCircle />
        </Link>
        <button
          className="rail-placeholder"
          aria-label="Calls, coming soon"
          onClick={() => useUiStore.getState().notify('Calls are coming soon.')}
        >
          <Phone />
        </button>
        <button
          className="rail-placeholder"
          aria-label="Stories, coming soon"
          onClick={() => useUiStore.getState().notify('Stories are coming soon.')}
        >
          <CirclePlay />
        </button>
        <Link href="/settings" aria-label="Settings">
          <Settings />
        </Link>
        <Link href="/settings" aria-label="Profile">
          {user && <UserAvatar user={user} size="small" />}
        </Link>
      </nav>
      <section className="conversation-sidebar">
        <header className="sidebar-header">
          <h1>Chats</h1>
          <button className="icon-button" aria-label="New chat" onClick={open}>
            <Pencil size={19} />
          </button>
        </header>
        <SearchBar inputRef={searchRef} />
        <div className="conversation-list">
          {isLoading && <p className="inline-loading">Loading chats…</p>}
          {error && (
            <div className="error-state" role="alert">
              <p>Chats could not be loaded.</p>
              <button onClick={() => void refetch()}>Retry</button>
            </div>
          )}
          {!isLoading && !error && conversations.length === 0 && (
            <section className="suggestion-empty-state" aria-label="People you may know">
              <h2>Start your first conversation</h2>
              <p>People you may know</p>
              {suggestions.isLoading && <p role="status">Finding people…</p>}
              {suggestions.error && (
                <div role="alert">
                  Suggestions could not be loaded.{' '}
                  <button onClick={() => void suggestions.refetch()}>Retry</button>
                </div>
              )}
              {!suggestions.isLoading && !suggestions.error && !suggestions.data?.length && (
                <p>No suggestions yet.</p>
              )}
              {suggestions.data?.map((person) => (
                <article className="suggestion-card" key={person.id}>
                  <Avatar
                    name={person.display_name}
                    color={person.avatar_color}
                    imageUrl={person.avatar_url}
                  />
                  <div className="suggestion-copy">
                    <b>{person.display_name}</b>
                    <span>{person.about}</span>
                    {person.masked_phone_number && <small>{person.masked_phone_number}</small>}
                  </div>
                  <button onClick={() => void messageSuggestion(person.id)}>Message</button>
                  <button
                    aria-label={`Add ${person.display_name}`}
                    onClick={() => void addSuggestion(person.id)}
                  >
                    Add
                  </button>
                </article>
              ))}
            </section>
          )}
          {conversations.map((item) => (
            <ConversationItem
              key={item.id}
              conversation={item}
              selected={pathname === `/chat/${item.id}`}
            />
          ))}
          {term.length > 1 && people.length > 0 && (
            <>
              <p className="list-section-title">People</p>
              {people.map((person) => (
                <button
                  className="contact-row"
                  key={person.id}
                  onClick={() => void startChat(person.id)}
                >
                  <Avatar
                    name={person.display_name}
                    color={person.avatar_color}
                    online={person.is_online}
                  />
                  <span>{person.display_name}</span>
                </button>
              ))}
            </>
          )}
          {term.length > 1 && peopleError && (
            <div className="error-state" role="alert">
              <p>People could not be searched.</p>
              <button onClick={() => void retryPeople()}>Retry search</button>
            </div>
          )}
        </div>
        <button className="compose-fab" aria-label="Compose" onClick={open}>
          <Pencil />
        </button>
      </section>
    </aside>
  );
}
