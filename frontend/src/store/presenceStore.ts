import { create } from 'zustand';

interface PresenceState {
  onlineUserIds: Record<string, boolean>;
  lastSeenAtByUser: Record<string, string | null>;
  connectionStatus: 'connected' | 'reconnecting' | 'disconnected';
  setPresence: (userId: string, isOnline: boolean, lastSeenAt?: string | null) => void;
  setSnapshot: (
    users: Array<{ user_id: string; is_online: boolean; last_seen_at?: string | null }>,
  ) => void;
  setConnectionStatus: (status: PresenceState['connectionStatus']) => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  onlineUserIds: {},
  lastSeenAtByUser: {},
  connectionStatus: 'disconnected',
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  setPresence: (userId, isOnline, lastSeenAt) =>
    set((state) => ({
      onlineUserIds: { ...state.onlineUserIds, [userId]: isOnline },
      lastSeenAtByUser:
        lastSeenAt === undefined
          ? state.lastSeenAtByUser
          : {
              ...state.lastSeenAtByUser,
              [userId]: lastSeenAt,
            },
    })),
  setSnapshot: (users) =>
    set((state) => ({
      onlineUserIds: Object.fromEntries(users.map((user) => [user.user_id, user.is_online])),
      lastSeenAtByUser: {
        ...state.lastSeenAtByUser,
        ...Object.fromEntries(users.map((user) => [user.user_id, user.last_seen_at ?? null])),
      },
    })),
}));
