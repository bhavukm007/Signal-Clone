import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { User } from '@/types/models';
import { useOverlayStore, type PrimaryOverlayInput } from '@/store/overlayStore';

export interface ToastEntry {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

export type ThemeMode = 'system' | 'light' | 'dark';
interface UiState {
  theme: ThemeMode;
  toasts: ToastEntry[];
  setTheme: (theme: ThemeMode) => void;
  notify: (message: string, action?: ToastEntry['action']) => number;
  clearToast: (id?: number) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  openModal: (name: string | null) => void;
  openProfile: (user: User | null) => void;
  openAttachmentViewer: (value: { conversationId: string; attachmentId: string } | null) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'system',
      toasts: [],
      setTheme: (theme) => set({ theme }),
      notify: (message, action) => {
        const id = Date.now() + Math.random();
        set((state) => ({ toasts: [...state.toasts.slice(-2), { id, message, action }] }));
        return id;
      },
      clearToast: (id) => {
        set((state) => ({ toasts: id ? state.toasts.filter((toast) => toast.id !== id) : [] }));
      },
      searchQuery: '',
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      openModal: (modal) => {
        const overlays: Record<string, PrimaryOverlayInput> = {
          'new-chat': { kind: 'new-message' },
          'add-contact': { kind: 'add-contact' },
          'create-group': { kind: 'new-group' },
          'conversation-info': { kind: 'conversation-info' },
        };
        useOverlayStore.getState().openPrimary(modal ? (overlays[modal] ?? null) : null);
      },
      openProfile: (profileUser) =>
        useOverlayStore
          .getState()
          .openPrimary(profileUser ? { kind: 'contact-profile', user: profileUser } : null),
      openAttachmentViewer: (attachmentViewer) =>
        useOverlayStore
          .getState()
          .openPrimary(attachmentViewer ? { kind: 'lightbox', ...attachmentViewer } : null),
    }),
    {
      name: 'signal-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ theme: state.theme }) as UiState,
    },
  ),
);
