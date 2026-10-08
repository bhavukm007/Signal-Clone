'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Timer } from 'lucide-react';
import { contactApi, conversationApi } from '@/lib/chatApi';
import { useConversationDetails } from '@/hooks/useConversationDetails';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

export function GroupInfoPanel({ conversationId }: { conversationId: string }) {
  const open = useUiStore((state) => state.modal === 'conversation-info');
  const close = () => useUiStore.getState().openModal(null);
  const viewer = useAuthStore((state) => state.user);
  const router = useRouter();
  const client = useQueryClient();
  const { data: conversation } = useConversationDetails(conversationId);
  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: contactApi.list,
    enabled: open,
  });
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  if (!open || !conversation) return null;
  const activeConversation = conversation;
  const current = activeConversation.participants.find(
    (participant) => participant.user.id === viewer?.id,
  );
  const isAdmin = current?.role === 'admin';
  const memberIds = new Set(
    activeConversation.participants.map((participant) => participant.user.id),
  );
  const availableContacts = contacts.filter((contact) => !memberIds.has(contact.user.id));
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['conversation', conversationId] }),
      client.invalidateQueries({ queryKey: ['conversations'] }),
    ]);
  };
  async function addMembers() {
    try {
      await conversationApi.addMembers(conversationId, selected);
      setSelected([]);
      setAdding(false);
      await refresh();
    } catch {
      useUiStore.getState().notify('Members could not be added.');
    }
  }
  async function updateName() {
    try {
      await conversationApi.updateGroup(
        conversationId,
        name || activeConversation.title,
        description || activeConversation.description || '',
      );
      setName('');
      setDescription('');
      await refresh();
    } catch {
      useUiStore.getState().notify('Group details could not be updated.');
    }
  }
  async function removeMember(userId: string) {
    try {
      await conversationApi.removeMember(conversationId, userId);
      if (userId === viewer?.id) {
        close();
        router.push('/');
      }
      await refresh();
    } catch {
      useUiStore.getState().notify('Member could not be removed.');
    }
  }
  async function setRole(userId: string, role: 'admin' | 'member') {
    try {
      await conversationApi.setRole(conversationId, userId, role);
      await refresh();
    } catch {
      useUiStore.getState().notify('Member role could not be changed.');
    }
  }
  async function setTimer(seconds: number) {
    try {
      await conversationApi.patch(conversationId, { disappearing_timer_seconds: seconds });
      await refresh();
    } catch {
      useUiStore.getState().notify('Disappearing timer could not be updated.');
    }
  }
  return (
    <Modal
      title={conversation.type === 'group' ? 'Group info' : 'Conversation info'}
      onClose={close}
    >
      <div className="group-summary">
        <Avatar name={conversation.title || 'Chat'} color="#8298c9" />
        <h3>{conversation.title || 'Chat'}</h3>
        <p>{conversation.participants.length} members</p>
      </div>
      <section className="timer-setting">
        <h3>
          <Timer size={16} /> Disappearing messages
        </h3>
        <select
          aria-label="Disappearing message timer"
          value={conversation.disappearing_timer_seconds || 0}
          onChange={(event) => void setTimer(Number(event.target.value))}
        >
          <option value={0}>Off</option>
          <option value={30}>30 seconds</option>
          <option value={300}>5 minutes</option>
          <option value={3600}>1 hour</option>
          <option value={86400}>1 day</option>
          <option value={604800}>1 week</option>
        </select>
      </section>
      {conversation.type === 'group' && (
        <>
          {isAdmin && (
            <div className="group-edit">
              <Input
                aria-label="Group name"
                placeholder={conversation.title}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <Input
                aria-label="Group description"
                placeholder={conversation.description || 'Description'}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
              <Button onClick={() => void updateName()}>Save group details</Button>
            </div>
          )}
          <div className="member-list">
            <h3>Members</h3>
            {conversation.participants.map(({ user, role }) => (
              <div className="member-row" key={user.id}>
                <Avatar
                  name={user.display_name}
                  color={user.avatar_color}
                  online={user.is_online}
                />
                <span className="member-name">
                  {user.display_name}
                  {user.id === viewer?.id ? ' (you)' : ''}
                  <small>{role === 'admin' ? 'Admin' : 'Member'}</small>
                </span>
                {isAdmin && user.id !== viewer?.id && (
                  <div className="member-actions">
                    <button
                      onClick={() => void setRole(user.id, role === 'admin' ? 'member' : 'admin')}
                    >
                      {role === 'admin' ? 'Demote' : 'Promote'}
                    </button>
                    <button onClick={() => void removeMember(user.id)}>Remove</button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {isAdmin && (
            <>
              <Button onClick={() => setAdding((value) => !value)}>
                {adding ? 'Cancel adding' : 'Add members'}
              </Button>
              {adding && (
                <div className="modal-list">
                  {availableContacts.map((contact) => (
                    <label className="contact-row" key={contact.id}>
                      <input
                        type="checkbox"
                        checked={selected.includes(contact.user.id)}
                        onChange={(event) =>
                          setSelected((ids) =>
                            event.target.checked
                              ? [...ids, contact.user.id]
                              : ids.filter((id) => id !== contact.user.id),
                          )
                        }
                      />
                      <Avatar name={contact.user.display_name} color={contact.user.avatar_color} />
                      <span>{contact.user.display_name}</span>
                    </label>
                  ))}
                  <Button
                    variant="primary"
                    disabled={!selected.length}
                    onClick={() => void addMembers()}
                  >
                    Add selected members
                  </Button>
                </div>
              )}
            </>
          )}
          <Button variant="danger" onClick={() => void removeMember(viewer?.id || '')}>
            Leave group
          </Button>
        </>
      )}
      {conversation.type === 'direct' && (
        <p className="safety-note">
          🔒 Messages are end-to-end encrypted. Safety number verification is a demo placeholder.
        </p>
      )}
    </Modal>
  );
}
