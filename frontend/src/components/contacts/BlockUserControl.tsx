'use client';
import { useQueryClient } from '@tanstack/react-query';
import { contactApi } from '@/lib/chatApi';
import { useContacts } from '@/hooks/useConversations';
import { useUiStore } from '@/store/uiStore';
import { Button } from '@/components/ui/Button';
import { useOverlayStore } from '@/store/overlayStore';

export function BlockUserControl({ userId }: { userId: string }) {
  const client = useQueryClient();
  const { data: contacts = [] } = useContacts();
  const blocked = contacts.find((contact) => contact.user.id === userId)?.is_blocked ?? false;
  async function update() {
    try {
      await contactApi.setBlocked(userId, !blocked);
      await client.invalidateQueries({ queryKey: ['contacts'] });
      await client.invalidateQueries({ queryKey: ['conversation'] });
      await client.invalidateQueries({ queryKey: ['conversations'] });
      useUiStore.getState().notify(blocked ? 'Contact unblocked.' : 'Contact blocked.', {
        label: 'Undo',
        run: () => {
          void contactApi
            .setBlocked(userId, blocked)
            .then(() =>
              Promise.all([
                client.invalidateQueries({ queryKey: ['contacts'] }),
                client.invalidateQueries({ queryKey: ['conversation'] }),
                client.invalidateQueries({ queryKey: ['conversations'] }),
              ]),
            )
            .catch(() =>
              useUiStore.getState().notify('Contact privacy setting could not be restored.'),
            );
        },
      });
      useOverlayStore.getState().closeTop();
    } catch {
      useUiStore.getState().notify('Contact privacy setting could not be updated.');
    }
  }
  return (
    <>
      <Button
        variant={blocked ? 'secondary' : 'danger'}
        onClick={() =>
          useOverlayStore.getState().push({
            kind: 'confirmation',
            title: blocked ? 'Unblock contact?' : 'Block contact?',
            message: blocked
              ? 'This contact will be able to message you again.'
              : 'This contact cannot message you or see your presence and typing status.',
            confirmLabel: `Confirm ${blocked ? 'unblock' : 'block'}`,
            onConfirm: update,
          })
        }
      >
        {blocked ? 'Unblock' : 'Block'}
      </Button>
    </>
  );
}
