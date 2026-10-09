'use client';

import { type ReactNode } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { useOverlayStore } from '@/store/overlayStore';

export function SidePanel({
  title,
  onClose,
  children,
  overlayId,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  overlayId?: number;
}) {
  return (
    <div
      className="side-panel-backdrop"
      data-overlay-id={overlayId}
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          overlayId !== undefined &&
          useOverlayStore.getState().isTop(overlayId)
        )
          onClose();
      }}
    >
      <aside className="side-panel" role="dialog" aria-modal="true" aria-label={title}>
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
