import { useEffect } from 'react';

interface ShortcutActions {
  newChat: () => void;
  focusSearch: () => void;
  close: () => void;
  nextConversation: (direction: -1 | 1) => void;
}

export function useKeyboardShortcuts(actions: ShortcutActions): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const command = event.ctrlKey || event.metaKey;
      if (command && event.key.toLowerCase() === 'n') {
        event.preventDefault(); actions.newChat();
      } else if (command && event.key.toLowerCase() === 'f') {
        event.preventDefault(); actions.focusSearch();
      } else if (event.key === 'Escape') {
        actions.close();
      } else if (event.altKey && event.key === 'ArrowUp') {
        event.preventDefault(); actions.nextConversation(-1);
      } else if (event.altKey && event.key === 'ArrowDown') {
        event.preventDefault(); actions.nextConversation(1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [actions]);
}
