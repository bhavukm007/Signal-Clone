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
  if (blocked) return null;
  async function update() {
    try {
      await contactApi.setBlocked(userId, !blocked);
      await client.invalidateQueries({ queryKey: ['contacts'] });
      await client.invalidateQueries({ queryKey: ['conversation'] });
      await client.invalidateQueries({ queryKey: ['conversations'] });
      useUiStore.getState().notify(blocked ? 'Contact unblocked.' : 'Contact blocked.');
      setConfirm(false);
    } catch {
      useUiStore.getState().notify('Contact privacy setting could not be updated.');
    }
  }
  return (
    <>
      <Button variant="danger" onClick={() => setConfirm(true)}>
        Block
      </Button>
      {confirm && (
        <Modal title="Block contact?" onClose={() => setConfirm(false)}>
          <p>This contact cannot message you or see your presence and typing status.</p>
          <Button variant="danger" onClick={() => void update()}>
            Confirm block
          </Button>
        </Modal>
      )}
    </>
  );
}
