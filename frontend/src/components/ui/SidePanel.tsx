'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { ArrowLeft, X } from 'lucide-react';

export function SidePanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panel = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.querySelector<HTMLElement>('[data-autofocus], button, input, select')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close.current();
        return;
      }
      if (event.key !== 'Tab' || !panel.current) return;
      const controls = Array.from(
        panel.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]',
        ),
      );
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, []);
  return (
    <div
      className="side-panel-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside className="side-panel" role="dialog" aria-modal="true" aria-label={title} ref={panel}>
        <header className="side-panel-header">
          <button className="side-panel-back" aria-label="Back" onClick={onClose}>
            <ArrowLeft size={20} />
            <span>Back</span>
          </button>
          <h2>{title}</h2>
          <button className="side-panel-close" aria-label="Close panel" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <div className="side-panel-content">{children}</div>
      </aside>
    </div>
  );
}
