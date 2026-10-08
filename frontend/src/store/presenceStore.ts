import { create } from 'zustand';

interface PresenceState {
  onlineUserIds: Record<string, boolean>;
  setPresence: (userId: string, isOnline: boolean) => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  onlineUserIds: {},
  setPresence: (userId, isOnline) => set((state) => ({
    onlineUserIds: { ...state.onlineUserIds, [userId]: isOnline },
  })),
}));
