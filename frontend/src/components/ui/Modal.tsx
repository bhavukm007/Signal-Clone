'use client';
import { type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useOverlayStore } from '@/store/overlayStore';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  overlayId?: number;
}

export function Modal({ title, onClose, children, overlayId }: ModalProps) {
  return (
    <div
      className="modal-backdrop"
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
      <section className="modal-card" role="dialog" aria-modal="true" aria-label={title}>
        <button className="icon-button modal-close" aria-label="Close dialog" onClick={onClose}>
          <X size={18} />
        </button>
        <h2>{title}</h2>
        {children}
      </section>
    </div>
  );
}
