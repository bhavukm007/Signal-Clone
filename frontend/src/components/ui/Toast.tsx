'use client';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useUiStore } from '@/store/uiStore';

export function ToastViewport() {
  const toasts = useUiStore((state) => state.toasts);
  const clear = useUiStore((state) => state.clearToast);
  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      useUiStore.getState().notify(detail);
    };
    window.addEventListener('signal-error', listener);
    return () => window.removeEventListener('signal-error', listener);
  }, []);
  return (
    <div className="toast-viewport" aria-live="polite" aria-relevant="additions">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => clear(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: { id: number; message: string; action?: { label: string; run: () => void } };
  onDismiss: () => void;
}) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(onDismiss, toast.action ? 6000 : 4000);
    return () => window.clearTimeout(timer);
  }, [onDismiss, paused, toast.action]);
  return (
    <div
      className="toast"
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <span>{toast.message}</span>
      {toast.action && (
        <button
          className="toast-action"
          onClick={() => {
            toast.action?.run();
            onDismiss();
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button className="icon-button" aria-label="Dismiss notification" onClick={onDismiss}>
        <X size={16} />
      </button>
    </div>
  );
}
