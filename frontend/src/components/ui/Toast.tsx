'use client';
import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useUiStore } from '@/store/uiStore';

export function ToastViewport() {
  const message = useUiStore((state) => state.toast);
  const clear = useUiStore((state) => state.clearToast);
  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      useUiStore.getState().notify(detail);
    };
    window.addEventListener('signal-error', listener);
    return () => window.removeEventListener('signal-error', listener);
  }, []);
  if (!message) return null;
  return <div className="toast" role="status" aria-live="polite">
    <span>{message}</span><button className="icon-button" aria-label="Dismiss notification" onClick={clear}><X size={16} /></button>
  </div>;
}
