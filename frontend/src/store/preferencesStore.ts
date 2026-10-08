import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface PreferencesState {
  readReceipts: boolean;
  typingIndicators: boolean;
  messageNotifications: boolean;
  notificationSound: boolean;
  setPreference: (key: keyof Omit<PreferencesState, 'setPreference'>, value: boolean) => void;
}

export const usePreferencesStore = create<PreferencesState>()(persist((set) => ({
  readReceipts: true,
  typingIndicators: true,
  messageNotifications: true,
  notificationSound: true,
  setPreference: (key, value) => set({ [key]: value }),
}), {
  name: 'signal-preferences',
  storage: createJSONStorage(() => localStorage),
  partialize: ({ readReceipts, typingIndicators, messageNotifications, notificationSound }) => ({
    readReceipts, typingIndicators, messageNotifications, notificationSound,
  }),
}));
