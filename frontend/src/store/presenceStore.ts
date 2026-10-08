import { create } from 'zustand';

interface PresenceState {
  onlineUserIds: Record<string, boolean>;
  connectionStatus: 'connected' | 'reconnecting' | 'disconnected';
  setPresence: (userId: string, isOnline: boolean) => void;
  setConnectionStatus: (status: PresenceState['connectionStatus']) => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  onlineUserIds: {},
  connectionStatus: 'disconnected',
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  setPresence: (userId, isOnline) =>
    set((state) => ({
      onlineUserIds: { ...state.onlineUserIds, [userId]: isOnline },
    })),
}));
