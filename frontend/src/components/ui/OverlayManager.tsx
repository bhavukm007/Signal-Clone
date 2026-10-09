'use client';

import { useEffect, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useOverlayStore } from '@/store/overlayStore';
import { Button } from '@/components/ui/Button';

export function OverlayInteractionManager() {
  const primary = useOverlayStore((state) => state.primary);
  const stack = useOverlayStore((state) => state.stack);
  const top = stack.at(-1)?.overlay;
  const topId = top?.id ?? primary?.id ?? null;
  const previousTopId = useRef<number | null>(null);

  useEffect(() => {
    if (!topId) {
      previousTopId.current = null;
      return;
    }
    if (previousTopId.current === null || topId > previousTopId.current) {
      requestAnimationFrame(() => {
        const root = document.querySelector<HTMLElement>(`[data-overlay-id="${topId}"]`);
        const target = root?.querySelector<HTMLElement>(
          '[data-autofocus], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]',
        );
        (target ?? root)?.focus();
      });
    }
    previousTopId.current = topId;
  }, [topId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const state = useOverlayStore.getState();
      const currentTop = state.stack.at(-1)?.overlay.id ?? state.primary?.id;
      if (!currentTop) return;
      const root = document.querySelector<HTMLElement>(`[data-overlay-id="${currentTop}"]`);
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        state.closeTop();
      } else if (event.key === 'Tab' && root) {
        const controls = Array.from(
          root.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((item) => item.offsetParent !== null);
        if (!controls.length) {
          event.preventDefault();
          root.focus();
          return;
        }
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (!root.contains(document.activeElement)) {
          event.preventDefault();
          first?.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  useEffect(() => {
    const mobilePanel =
      (primary?.kind === 'conversation-info' || primary?.kind === 'contact-profile') &&
      window.matchMedia('(max-width: 767px)').matches;
    const locksScroll = Boolean(
      stack.length ||
      (primary && primary.kind !== 'conversation-info' && primary.kind !== 'contact-profile') ||
      mobilePanel,
    );
    if (!locksScroll) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = oldOverflow;
    };
  }, [primary, stack.length]);

  if (!top) return null;
  const close = () => useOverlayStore.getState().closeTop();
  return (
    <Modal title={top.title} onClose={close} overlayId={top.id}>
      <p>{top.message}</p>
      {top.kind === 'safety-number' && <code>12345 67890 12345 67890</code>}
      {top.confirmLabel && top.onConfirm && (
        <Button variant="danger" onClick={() => void top.onConfirm?.()}>
          {top.confirmLabel}
        </Button>
      )}
    </Modal>
  );
}
