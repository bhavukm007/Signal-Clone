import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { User } from '@/types/models';

interface AuthState {
  token: string | null;
  user: User | null;
  hydrated: boolean;
  setSession: (token: string, user: User) => void;
  setUser: (user: User) => void;
  clearSession: () => void;
  setHydrated: (hydrated: boolean) => void;
}

export const useAuthStore = create<AuthState>()(persist(
  (set) => ({
    token: null,
    user: null,
    hydrated: false,
    setSession: (token, user) => set({ token, user }),
    setUser: (user) => set({ user }),
    clearSession: () => set({ token: null, user: null }),
    setHydrated: (hydrated) => set({ hydrated }),
  }),
  {
    name: 'signal-auth',
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({ token: state.token, user: state.user }),
    onRehydrateStorage: () => (state) => state?.setHydrated(true),
  },
));
