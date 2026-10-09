import { create } from 'zustand';
import type { User } from '@/types/models';

export type PrimaryOverlay =
  | { id: number; kind: 'new-message' | 'new-group' | 'add-contact' }
  | { id: number; kind: 'conversation-info' }
  | { id: number; kind: 'contact-profile'; user: User }
  | { id: number; kind: 'lightbox'; conversationId: string; attachmentId: string }
  | { id: number; kind: 'blocked-users' }
  | { id: number; kind: 'avatar-crop' };

export type PrimaryOverlayInput =
  | { kind: 'new-message' | 'new-group' | 'add-contact' }
  | { kind: 'conversation-info' }
  | { kind: 'contact-profile'; user: User }
  | { kind: 'lightbox'; conversationId: string; attachmentId: string }
  | { kind: 'blocked-users' }
  | { kind: 'avatar-crop' };

export type NestedOverlay = {
  id: number;
  kind: 'confirmation' | 'safety-number';
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm?: () => void | Promise<void>;
};

interface OverlayState {
  primary: PrimaryOverlay | null;
  stack: Array<{ overlay: NestedOverlay; opener: HTMLElement | null }>;
  origin: HTMLElement | null;
  openPrimary: (overlay: PrimaryOverlayInput | null) => void;
  push: (overlay: Omit<NestedOverlay, 'id'>) => void;
  closeTop: () => void;
  closeAll: () => void;
  isTop: (id: number) => boolean;
}

let nextId = 0;
const currentElement = () =>
  typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;

export const useOverlayStore = create<OverlayState>((set, get) => ({
  primary: null,
  stack: [],
  origin: null,
  openPrimary: (value) => {
    const state = get();
    if (value === null) {
      get().closeAll();
      return;
    }
    set({
      primary: { ...value, id: ++nextId } as PrimaryOverlay,
      stack: [],
      origin: state.primary ? state.origin : currentElement(),
    });
  },
  push: (value) =>
    set((state) => ({
      stack: [...state.stack, { overlay: { ...value, id: ++nextId }, opener: currentElement() }],
    })),
  closeTop: () => {
    const { primary, stack, origin } = get();
    if (stack.length) {
      const closing = stack[stack.length - 1];
      set({ stack: stack.slice(0, -1) });
      requestAnimationFrame(() => closing.opener?.focus());
      return;
    }
    if (!primary) return;
    set({ primary: null, stack: [], origin: null });
    requestAnimationFrame(() => origin?.focus());
  },
  closeAll: () => {
    const { origin, primary } = get();
    if (!primary) return;
    set({ primary: null, stack: [], origin: null });
    requestAnimationFrame(() => origin?.focus());
  },
  isTop: (id) => {
    const { primary, stack } = get();
    return stack.length ? stack[stack.length - 1]?.overlay.id === id : primary?.id === id;
  },
}));
