import { useMutation, useQueryClient } from '@tanstack/react-query';
import { messageApi, uploadApi } from '@/lib/chatApi';
import { useUiStore } from '@/store/uiStore';

export function useMessageActions(conversationId: string) {
  const client = useQueryClient();
  const notify = useUiStore((state) => state.notify);
  const reaction = useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      messageApi.react(messageId, emoji),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['messages', conversationId] }),
    onError: () => notify('Reaction could not be saved.'),
  });
  const removeReaction = useMutation({
    mutationFn: messageApi.removeReaction,
    onSuccess: () => void client.invalidateQueries({ queryKey: ['messages', conversationId] }),
    onError: () => notify('Reaction could not be removed.'),
  });
  const attachment = useMutation({
    mutationFn: uploadApi.upload,
    onError: () => notify('Upload failed.'),
  });
  return {
    react: (messageId: string, emoji: string) => reaction.mutate({ messageId, emoji }),
    removeReaction: (messageId: string) => removeReaction.mutate(messageId),
    removeMessage: (messageId: string) =>
      messageApi
        .remove(messageId)
        .then(() => client.invalidateQueries({ queryKey: ['messages', conversationId] })),
    upload: (file: File) => attachment.mutateAsync(file).catch(() => null),
    uploading: attachment.isPending,
  };
}
