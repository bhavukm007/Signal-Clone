'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { contactApi, conversationApi } from '@/lib/chatApi';
import { useUiStore } from '@/store/uiStore';
import { useDebounce } from '@/hooks/useDebounce';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
export function NewChatModal() {
  const modal = useUiStore((s) => s.modal);
  const close = () => useUiStore.getState().openModal(null);
  const [q, setQ] = useState('');
  const [groupName, setGroupName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const router = useRouter();
  const qc = useQueryClient();
  const term = useDebounce(q, 250);
  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: contactApi.list,
    enabled: Boolean(modal),
  });
  const { data: users = [] } = useQuery({
    queryKey: ['user-search', term],
    queryFn: () => contactApi.search(term),
    enabled: Boolean(modal) && term.length > 1,
  });
  async function start(userId: string) {
    try {
      const c = await conversationApi.direct(userId);
      await qc.invalidateQueries({ queryKey: ['conversations'] });
      close();
      router.push(`/chat/${c.id}`);
    } catch {
      useUiStore.getState().notify('Could not start this conversation.');
    }
  }
  async function addContact() {
    try {
      await contactApi.add(q.trim());
      await qc.invalidateQueries({ queryKey: ['contacts'] });
      setQ('');
      useUiStore.getState().notify('Contact added.');
      close();
    } catch {
      useUiStore.getState().notify('Could not add that contact.');
    }
  }
  async function createGroup() {
    try {
      const group = await conversationApi.createGroup(groupName.trim(), selected);
      await qc.invalidateQueries({ queryKey: ['conversations'] });
      close();
      setSelected([]);
      setGroupName('');
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
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Phone number or username"
          aria-label="Contact identifier"
        />
        <Button variant="primary" onClick={() => void addContact()} disabled={q.trim().length < 3}>
          Add contact
        </Button>
      </Modal>
    );
  if (modal === 'create-group')
    return (
      <Modal title="New group" onClose={close}>
        <Input
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="Group name"
          aria-label="Group name"
        />
        <div className="modal-list">
          {contacts.map((c) => (
            <label className="contact-row" key={c.id}>
              <input
                type="checkbox"
                checked={selected.includes(c.user.id)}
                onChange={(e) =>
                  setSelected((ids) =>
                    e.target.checked ? [...ids, c.user.id] : ids.filter((id) => id !== c.user.id),
                  )
                }
              />
              <Avatar name={c.user.display_name} color={c.user.avatar_color} />
              <span>{c.nickname || c.user.display_name}</span>
            </label>
          ))}
        </div>
        <Button variant="primary" onClick={() => void createGroup()} disabled={!groupName.trim()}>
          Create group
        </Button>
      </Modal>
    );
  return (
    <Modal title="New message" onClose={close}>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name or number"
        aria-label="Find a contact"
      />
      <div className="modal-list">
        {contacts.map((c) => (
          <div className="contact-row" key={c.id}>
            <button className="contact-start" onClick={() => void start(c.user.id)}>
              <Avatar name={c.user.display_name} color={c.user.avatar_color} />
              <span>{c.nickname || c.user.display_name}</span>
            </button>
          </div>
        ))}
        {users
          .filter((u) => !contacts.some((c) => c.user.id === u.id))
          .map((u) => (
            <div className="contact-row" key={u.id}>
              <button className="contact-start" onClick={() => void start(u.id)}>
                <Avatar name={u.display_name} color={u.avatar_color} />
                <span>
                  {u.display_name} · {u.phone_number || u.username}
                </span>
              </button>
            </div>
          ))}
      </div>
      <Button onClick={() => useUiStore.getState().openModal('add-contact')}>Add contact</Button>
      <Button onClick={() => useUiStore.getState().openModal('create-group')}>New group</Button>
    </Modal>
  );
}
