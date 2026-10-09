'use client';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Switch } from '@/components/ui/Switch';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { UserAvatar } from '@/components/ui/Avatar';
import { useContacts } from '@/hooks/useConversations';
import { contactApi } from '@/lib/chatApi';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useUiStore } from '@/store/uiStore';

export function PrivacySection() {
  const readReceipts = usePreferencesStore((state) => state.readReceipts);
  const typingIndicators = usePreferencesStore((state) => state.typingIndicators);
  const set = usePreferencesStore((state) => state.setPreference);
  const [showBlocked, setShowBlocked] = useState(false);
  const client = useQueryClient();
  const { data: contacts = [] } = useContacts();
  const blocked = contacts.filter((contact) => contact.is_blocked);

  async function unblock(userId: string) {
    try {
      await contactApi.setBlocked(userId, false);
      await Promise.all([
        client.invalidateQueries({ queryKey: ['contacts'] }),
        client.invalidateQueries({ queryKey: ['conversations'] }),
        client.invalidateQueries({ queryKey: ['conversation'] }),
      ]);
      useUiStore.getState().notify('Contact unblocked.');
    } catch {
      useUiStore.getState().notify('Contact privacy setting could not be updated.');
    }
  }
  return (
    <section className="settings-section">
      <h2>Privacy</h2>
      <label className="setting-row">
        <span>
          Read receipts<small>Let others know when you’ve read their messages</small>
        </span>
        <Switch
          label="Read receipts"
          checked={readReceipts}
          onChange={(value) => set('readReceipts', value)}
        />
      </label>
      <label className="setting-row">
        <span>
          Typing indicators<small>Show when you’re typing</small>
        </span>
        <Switch
          label="Typing indicators"
          checked={typingIndicators}
          onChange={(value) => set('typingIndicators', value)}
        />
      </label>
      <button className="settings-link" onClick={() => setShowBlocked(true)}>
        Blocked users <span>Manage</span>
      </button>
      {showBlocked && (
        <Modal title="Blocked users" onClose={() => setShowBlocked(false)}>
          {blocked.length === 0 ? (
            <p className="blocked-empty">No blocked users</p>
          ) : (
            <div className="blocked-user-list">
              {blocked.map((contact) => (
                <div className="blocked-user-row" key={contact.id}>
                  <UserAvatar user={contact.user} size="small" />
                  <span>{contact.user.display_name}</span>
                  <Button variant="secondary" onClick={() => void unblock(contact.user.id)}>
                    Unblock
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </section>
  );
}
