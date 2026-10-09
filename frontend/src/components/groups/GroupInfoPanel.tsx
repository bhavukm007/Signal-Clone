'use client';
import { useState } from 'react';
import Image from 'next/image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Bell, FileText, MoreVertical, ShieldCheck, Timer } from 'lucide-react';
import { attachmentApi, contactApi, conversationApi } from '@/lib/chatApi';
import { useConversationDetails } from '@/hooks/useConversationDetails';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { BlockUserControl } from '@/components/contacts/BlockUserControl';
import { SidePanel } from '@/components/ui/SidePanel';
import { useOverlayStore } from '@/store/overlayStore';
import { Switch } from '@/components/ui/Switch';
import { formatFileSize, formatPhoneNumber } from '@/lib/formatters';
import { useMediaObjectUrl } from '@/hooks/useMediaObjectUrl';
import type { Attachment } from '@/types/models';
import { downloadMedia } from '@/lib/downloadMedia';

function MediaThumb({ attachment, onOpen }: { attachment: Attachment; onOpen: () => void }) {
  const url = useMediaObjectUrl(attachment.url);
  return (
    <button
      className="shared-media-thumb"
      onClick={onOpen}
      aria-label={`Open ${attachment.file_name}`}
    >
      {url ? (
        <Image
          src={url}
          alt={attachment.file_name}
          fill
          sizes="(max-width: 420px) 33vw, 120px"
          unoptimized
          loading="lazy"
        />
      ) : (
        <span>Loading…</span>
      )}
    </button>
  );
}

export function GroupInfoPanel({ conversationId }: { conversationId: string }) {
  const overlay = useOverlayStore((state) => state.primary);
  const open = overlay?.kind === 'conversation-info';
  const close = () => useOverlayStore.getState().closeTop();
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
  const [memberMenuId, setMemberMenuId] = useState<string | null>(null);
  const [mediaTab, setMediaTab] = useState<'media' | 'files'>('media');
  const { data: mediaMessages = [] } = useQuery({
    queryKey: ['conversation-media', conversationId],
    queryFn: () => attachmentApi.listForConversation(conversationId),
    enabled: open && conversation?.type === 'direct',
  });
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
  const directPeer = activeConversation.participants.find(
    ({ user }) => user.id !== viewer?.id,
  )?.user;
  const muted = Boolean(
    activeConversation.muted_until &&
    new Date(activeConversation.muted_until).getTime() > Date.now(),
  );
  const images = mediaMessages.filter((attachment) => attachment.mime_type.startsWith('image/'));
  const files = mediaMessages.filter((attachment) => !attachment.mime_type.startsWith('image/'));
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
  async function setMuted(value: boolean) {
    try {
      await conversationApi.patch(conversationId, { mute_notifications: value });
      await refresh();
    } catch {
      useUiStore.getState().notify('Mute setting could not be updated.');
    }
  }
  function openImage(attachment: Attachment) {
    useUiStore.getState().openAttachmentViewer({ conversationId, attachmentId: attachment.id });
  }
  return (
    <SidePanel
      title={conversation.type === 'group' ? 'Group info' : 'Conversation info'}
      onClose={close}
      overlayId={overlay?.id}
    >
      {conversation.type === 'direct' && directPeer ? (
        <div className="direct-profile-summary">
          <Avatar
            name={directPeer.display_name}
            color={directPeer.avatar_color}
            imageUrl={directPeer.avatar_url}
          />
          <h3>{directPeer.display_name}</h3>
          {directPeer.about && <p>{directPeer.about}</p>}
          {directPeer.phone_number && <p>{formatPhoneNumber(directPeer.phone_number)}</p>}
        </div>
      ) : (
        <div className="group-summary">
          <Avatar name={conversation.title || 'Chat'} color="#8298c9" />
          <h3>{conversation.title || 'Chat'}</h3>
          <p>{conversation.participants.length} members</p>
        </div>
      )}
      {conversation.type === 'direct' && (
        <>
          <div className="profile-media-tabs" role="tablist" aria-label="Conversation attachments">
            <button
              role="tab"
              aria-selected={mediaTab === 'media'}
              onClick={() => setMediaTab('media')}
            >
              Shared media
            </button>
            <button
              role="tab"
              aria-selected={mediaTab === 'files'}
              onClick={() => setMediaTab('files')}
            >
              Files
            </button>
          </div>
          {mediaTab === 'media' ? (
            <div className="shared-media-grid">
              {images.map((attachment) => (
                <MediaThumb
                  key={attachment.id}
                  attachment={attachment}
                  onOpen={() => openImage(attachment)}
                />
              ))}
              {!images.length && <p className="profile-empty">No shared media yet</p>}
            </div>
          ) : (
            <div className="shared-file-list">
              {files.map((attachment) => (
                <div className="shared-file-row" key={attachment.id}>
                  <FileText size={19} />
                  <span>
                    <b>{attachment.file_name}</b>
                    <small>{formatFileSize(attachment.size_bytes)}</small>
                  </span>
                  <button
                    aria-label={`Download ${attachment.file_name}`}
                    onClick={() =>
                      void downloadMedia(attachment.url, attachment.file_name).catch(() =>
                        useUiStore.getState().notify('The attachment could not be downloaded.'),
                      )
                    }
                  >
                    Download
                  </button>
                </div>
              ))}
              {!files.length && <p className="profile-empty">No files shared yet</p>}
            </div>
          )}
          <label className="setting-row panel-setting-row">
            <span>
              <Bell size={18} /> Mute notifications
            </span>
            <Switch
              label="Mute notifications"
              checked={muted}
              onChange={(value) => void setMuted(value)}
            />
          </label>
        </>
      )}
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
                  <div
                    className="member-menu-wrap"
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node))
                        setMemberMenuId(null);
                    }}
                  >
                    <button
                      className="icon-button member-menu-trigger"
                      aria-label={`Member actions for ${user.display_name}`}
                      aria-expanded={memberMenuId === user.id}
                      onClick={() =>
                        setMemberMenuId((value) => (value === user.id ? null : user.id))
                      }
                    >
                      <MoreVertical size={18} />
                    </button>
                    {memberMenuId === user.id && (
                      <div
                        className="member-menu"
                        role="menu"
                        aria-label={`${user.display_name} actions`}
                      >
                        <button
                          role="menuitem"
                          onClick={() => {
                            void setRole(user.id, role === 'admin' ? 'member' : 'admin');
                            setMemberMenuId(null);
                          }}
                        >
                          {role === 'admin' ? 'Remove admin' : 'Make admin'}
                        </button>
                        <button
                          role="menuitem"
                          onClick={() => {
                            useOverlayStore.getState().push({
                              kind: 'confirmation',
                              title: `Remove ${user.display_name}?`,
                              message: 'They will no longer see messages in this group.',
                              confirmLabel: 'Remove from group',
                              onConfirm: async () => {
                                useOverlayStore.getState().closeTop();
                                await removeMember(user.id);
                              },
                            });
                            setMemberMenuId(null);
                          }}
                        >
                          Remove from group
                        </button>
                      </div>
                    )}
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
          <Button
            variant="danger"
            onClick={() =>
              useOverlayStore.getState().push({
                kind: 'confirmation',
                title: 'Exit group?',
                message: 'You will stop receiving messages from this group.',
                confirmLabel: 'Exit group',
                onConfirm: async () => {
                  useOverlayStore.getState().closeTop();
                  await removeMember(viewer?.id || '');
                },
              })
            }
          >
            Exit group
          </Button>
        </>
      )}
      {conversation.type === 'direct' && (
        <>
          <Button
            variant="secondary"
            onClick={() =>
              useOverlayStore.getState().push({
                kind: 'safety-number',
                title: 'Safety number',
                message:
                  'This is a demo safety number and does not represent a real end-to-end encrypted key. 12345 67890 12345 67890',
              })
            }
          >
            <ShieldCheck size={17} /> View safety number
          </Button>
          {conversation.participants
            .filter(({ user }) => user.id !== viewer?.id)
            .map(({ user }) => (
              <div className="contact-menu-row" key={user.id}>
                <span>Contact privacy</span>
                <BlockUserControl userId={user.id} />
              </div>
            ))}
        </>
      )}
    </SidePanel>
  );
}
