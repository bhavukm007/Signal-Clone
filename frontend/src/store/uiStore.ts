import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemeMode = 'system' | 'light' | 'dark';
interface UiState {
  theme: ThemeMode;
  toast: string | null;
  setTheme: (theme: ThemeMode) => void;
  notify: (message: string) => void;
  clearToast: () => void;
  searchQuery: string;
  modal: string | null;
  setSearchQuery: (query: string) => void;
  openModal: (name: string | null) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'system',
      toast: null,
      setTheme: (theme) => set({ theme }),
      notify: (message) => {
        set({ toast: message });
        window.setTimeout(() => set({ toast: null }), 3000);
      },
      clearToast: () => set({ toast: null }),
      searchQuery: '',
      modal: null,
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      openModal: (modal) => set({ modal }),
    }),
    {
      name: 'signal-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ theme: state.theme }) as UiState,
    },
  ),
);
