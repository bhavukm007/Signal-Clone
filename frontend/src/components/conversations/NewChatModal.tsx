'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UserRoundPlus, UserRoundSearch, UsersRound, X } from 'lucide-react';
import { contactApi, conversationApi } from '@/lib/chatApi';
import { useUiStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { useDebounce } from '@/hooks/useDebounce';
import { matchesContactQuery } from '@/lib/contacts';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { ContactPickerList, type PickerPerson } from '@/components/conversations/ContactPickerList';

function looksLikeIdentifier(value: string): boolean {
  const text = value.trim();
  return /^\+?[\d][\d\s().-]{2,}$/u.test(text) || /^[\p{L}\p{N}][\p{L}\p{N}_.-]{2,}$/u.test(text);
}

export function NewChatModal() {
  const modal = useUiStore((state) => state.modal);
  const currentUser = useAuthStore((state) => state.user);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [groupName, setGroupName] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const term = useDebounce(query.trim(), 250);
  const pickerRef = useRef<HTMLDivElement>(null);
  const active = modal === 'new-chat' || modal === 'create-group';
  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: contactApi.list,
    enabled: active,
  });
  const { data: users = [], isFetching: searchingUsers } = useQuery({
    queryKey: ['user-search', term],
    queryFn: () => contactApi.search(term),
    enabled: modal === 'new-chat' && term.length > 1,
  });
  const contactPeople = useMemo<PickerPerson[]>(
    () =>
      contacts
        .map((contact) => ({ ...contact.user, is_contact: true }))
        .filter((person) => person.id !== currentUser?.id),
    [contacts, currentUser?.id],
  );
  const people = useMemo<PickerPerson[]>(() => {
    const knownIds = new Set(contactPeople.map((person) => person.id));
    const searched = users
      .filter((person) => person.id !== currentUser?.id && !knownIds.has(person.id))
      .map((person) => ({ ...person, is_contact: false }));
    return [...contactPeople, ...searched].filter((person) => matchesContactQuery(person, query));
  }, [contactPeople, currentUser?.id, query, users]);

  function close() {
    useUiStore.getState().openModal(null);
    setQuery('');
    setSelectedIds([]);
    setGroupName('');
  }

  async function start(userId: string, isContact: boolean) {
    try {
      if (!isContact) await contactApi.addById(userId);
      const conversation = await conversationApi.direct(userId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['contacts'] }),
        queryClient.invalidateQueries({ queryKey: ['conversations'] }),
      ]);
      close();
      router.push(`/chat/${conversation.id}`);
    } catch {
      useUiStore.getState().notify('Could not start this conversation.');
    }
  }

  async function findAndStart() {
    try {
      const contact = await contactApi.add(query.trim());
      await start(contact.user.id, true);
    } catch {
      useUiStore.getState().notify(`Could not find ${query.trim()}.`);
    }
  }

  async function addContact() {
    try {
      await contactApi.add(query.trim());
      await queryClient.invalidateQueries({ queryKey: ['contacts'] });
      useUiStore.getState().notify('Contact added.');
      close();
    } catch {
      useUiStore.getState().notify('Could not add that contact.');
    }
  }

  async function createGroup() {
    try {
      const group = await conversationApi.createGroup(groupName.trim(), selectedIds);
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      close();
      router.push(`/chat/${group.id}`);
    } catch {
      useUiStore.getState().notify('Could not create the group.');
    }
  }

  if (!modal) return null;
  if (modal === 'add-contact')
    return (
      <Modal title="Add contact" onClose={close}>
        <Input
          data-autofocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Phone number or username"
          aria-label="Contact identifier"
        />
        <Button
          variant="primary"
          onClick={() => void addContact()}
          disabled={query.trim().length < 3}
        >
          Add contact
        </Button>
      </Modal>
    );

  if (modal === 'create-group') {
    const selected = contactPeople.filter((person) => selectedIds.includes(person.id));
    return (
      <Modal title="New group" onClose={close}>
        <div className="contact-picker-modal group-picker-modal">
          <Input
            data-autofocus
            aria-label="Group name"
            placeholder="Group name"
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
          />
          {selected.length > 0 && (
            <div className="selected-contacts" aria-label="Selected members">
              {selected.map((person) => (
                <button
                  className="selected-contact-chip"
                  key={person.id}
                  onClick={() => setSelectedIds((ids) => ids.filter((id) => id !== person.id))}
                  aria-label={`Remove ${person.display_name}`}
                >
                  <Avatar name={person.display_name} color={person.avatar_color} size="tiny" />
                  <span>{person.display_name}</span>
                  <X size={13} />
                </button>
              ))}
            </div>
          )}
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                pickerRef.current?.querySelector<HTMLElement>('[data-picker-item]')?.focus();
              }
            }}
            placeholder="Find members"
            aria-label="Find group members"
          />
          <ContactPickerList
            contacts={contactPeople.filter((person) => matchesContactQuery(person, query))}
            query={query}
            selectedIds={selectedIds}
            listRef={pickerRef}
            onToggle={(person, checked) =>
              setSelectedIds((ids) =>
                checked ? [...ids, person.id] : ids.filter((id) => id !== person.id),
              )
            }
          />
          <div className="picker-footer">
            <Button
              variant="primary"
              onClick={() => void createGroup()}
              disabled={!groupName.trim() || selectedIds.length === 0}
            >
              Create
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="New message" onClose={close}>
      <div className="contact-picker-modal">
        <Input
          data-autofocus
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              const first = pickerRef.current?.querySelector<HTMLElement>('[data-picker-item]');
              (first ?? document.querySelector<HTMLElement>('[data-contact-find]'))?.focus();
            }
          }}
          placeholder="Search by name or number"
          aria-label="Search contacts"
        />
        <div className="contact-picker-actions">
          <button
            className="contact-picker-action"
            onClick={() => {
              setQuery('');
              setSelectedIds([]);
              useUiStore.getState().openModal('create-group');
            }}
          >
            <UsersRound size={19} />
            <span>New group</span>
          </button>
          <button
            className="contact-picker-action"
            onClick={() => useUiStore.getState().openModal('add-contact')}
          >
            <UserRoundPlus size={19} />
            <span>Add contact</span>
          </button>
        </div>
        <h3 className="contact-list-heading">Contacts</h3>
        {people.length === 0 && !searchingUsers && looksLikeIdentifier(query) && (
          <button
            className="contact-picker-find"
            data-contact-find
            onClick={() => void findAndStart()}
          >
            <UserRoundSearch size={20} />
            <span>
              Find <b>{query.trim()}</b>
            </span>
          </button>
        )}
        <ContactPickerList
          contacts={people}
          query={query}
          listRef={pickerRef}
          onChoose={(person) => void start(person.id, person.is_contact)}
        />
        {searchingUsers && term && <p className="contact-search-loading">Searching…</p>}
      </div>
    </Modal>
  );
}
