'use client';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { contactApi } from '@/lib/chatApi';
import { useContacts } from '@/hooks/useConversations';
import { useUiStore } from '@/store/uiStore';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

export function BlockUserControl({ userId }: { userId: string }) {
  const [confirm, setConfirm] = useState(false);
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
      setConfirm(false);
    } catch {
      useUiStore.getState().notify('Contact privacy setting could not be updated.');
    }
  }
  return (
    <>
      <Button variant={blocked ? 'secondary' : 'danger'} onClick={() => setConfirm(true)}>
        {blocked ? 'Unblock' : 'Block'}
      </Button>
      {confirm && (
        <Modal
          title={blocked ? 'Unblock contact?' : 'Block contact?'}
          onClose={() => setConfirm(false)}
        >
          <p>
            {blocked
              ? 'This contact will be able to message you again.'
              : 'This contact cannot message you or see your presence and typing status.'}
          </p>
          <Button variant="danger" onClick={() => void update()}>
            Confirm {blocked ? 'unblock' : 'block'}
          </Button>
        </Modal>
      )}
    </>
  );
}
