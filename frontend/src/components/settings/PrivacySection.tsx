'use client';
import { useQueryClient } from '@tanstack/react-query';
import { Switch } from '@/components/ui/Switch';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { UserAvatar } from '@/components/ui/Avatar';
import { useContacts } from '@/hooks/useConversations';
import { contactApi, userApi } from '@/lib/chatApi';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useUiStore } from '@/store/uiStore';
import { useOverlayStore } from '@/store/overlayStore';
import { useAuthStore } from '@/store/authStore';

export function PrivacySection() {
  const readReceipts = usePreferencesStore((state) => state.readReceipts);
  const typingIndicators = usePreferencesStore((state) => state.typingIndicators);
  const set = usePreferencesStore((state) => state.setPreference);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const overlay = useOverlayStore((state) => state.primary);
  const showBlocked = overlay?.kind === 'blocked-users';
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
      useUiStore.getState().notify('Contact unblocked.', {
        label: 'Undo',
        run: () => {
          void contactApi
            .setBlocked(userId, true)
            .then(() =>
              Promise.all([
                client.invalidateQueries({ queryKey: ['contacts'] }),
                client.invalidateQueries({ queryKey: ['conversations'] }),
                client.invalidateQueries({ queryKey: ['conversation'] }),
              ]),
            )
            .catch(() => useUiStore.getState().notify('Contact could not be blocked again.'));
        },
      });
    } catch {
      useUiStore.getState().notify('Contact privacy setting could not be updated.');
    }
  }
  return (
    <section className="settings-section">
      <h2>Privacy</h2>
      <label className="setting-row">
        <span>
          Let others find me<small>Demo-only discovery for starting conversations</small>
        </span>
        <Switch
          label="Let others find me"
          checked={user?.is_discoverable ?? true}
          onChange={(value) => {
            void userApi
              .setDiscoverability(value)
              .then(setUser)
              .catch(() => useUiStore.getState().notify('Privacy setting could not be saved.'));
          }}
        />
      </label>
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
      <button
        className="settings-link"
        onClick={() => useOverlayStore.getState().openPrimary({ kind: 'blocked-users' })}
      >
        Blocked users <span>Manage</span>
      </button>
      {showBlocked && overlay && (
        <Modal
          title="Blocked users"
          onClose={() => useOverlayStore.getState().closeTop()}
          overlayId={overlay.id}
        >
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
