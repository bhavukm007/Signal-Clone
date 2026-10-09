import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { User } from '@/types/models';

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
  modal: string | null;
  profileUser: User | null;
  attachmentViewer: { conversationId: string; attachmentId: string } | null;
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
      modal: null,
      profileUser: null,
      attachmentViewer: null,
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      openModal: (modal) => set({ modal }),
      openProfile: (profileUser) => set({ profileUser }),
      openAttachmentViewer: (attachmentViewer) => set({ attachmentViewer }),
    }),
    {
      name: 'signal-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ theme: state.theme }) as UiState,
    },
  ),
);
