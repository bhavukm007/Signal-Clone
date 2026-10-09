'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { ArrowLeft, ArrowRight, Download, Forward, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { attachmentApi } from '@/lib/chatApi';
import { useMediaObjectUrl } from '@/hooks/useMediaObjectUrl';
import { useUiStore } from '@/store/uiStore';
import { useOverlayStore } from '@/store/overlayStore';
import { dayLabel, fullTime } from '@/lib/formatters';
import { downloadMedia } from '@/lib/downloadMedia';
import type { ConversationAttachment } from '@/types/models';

export function AttachmentLightbox({
  conversationId,
  attachmentId,
  id,
}: {
  conversationId: string;
  attachmentId: string;
  id: number;
}) {
  const close = () => useOverlayStore.getState().closeTop();
  const { data: entries = [] } = useQuery({
    queryKey: ['lightbox-messages', conversationId],
    queryFn: () => attachmentApi.listForConversation(conversationId),
  });
  const images = useMemo(
    () => entries.filter((attachment) => attachment.mime_type.startsWith('image/')),
    [entries],
  );
  const initialIndex = Math.max(
    0,
    images.findIndex((item) => item.id === attachmentId),
  );
  const [index, setIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const zoomed = zoom > 1.05;
  const [downloading, setDownloading] = useState(false);
  const pointerStart = useRef<number | null>(null);
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null);
  const entry: ConversationAttachment | undefined = images[index];
  const src = useMediaObjectUrl(entry?.url);
  useEffect(() => setIndex(initialIndex), [initialIndex]);
  useEffect(() => setZoom(1), [index]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') setIndex((value) => (value + 1) % images.length);
      else if (event.key === 'ArrowLeft')
        setIndex((value) => (value - 1 + images.length) % images.length);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [images.length]);

  async function download() {
    if (!entry) return;
    setDownloading(true);
    try {
      await downloadMedia(entry.url, entry.file_name);
    } catch {
      useUiStore.getState().notify('The attachment could not be downloaded.');
    } finally {
      setDownloading(false);
    }
  }

  if (!entry) return null;
  return (
    <div
      className="lightbox-backdrop"
      data-overlay-id={id}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && useOverlayStore.getState().isTop(id)) close();
      }}
    >
      <section className="image-lightbox" role="dialog" aria-modal="true" aria-label="Photo viewer">
        <header className="lightbox-toolbar">
          <button aria-label="Close photo viewer" onClick={close}>
            <X />
          </button>
          <div className="lightbox-byline">
            <b>{entry.message.sender.display_name}</b>
            <small>
              {dayLabel(entry.message.created_at)} · {fullTime(entry.message.created_at)}
            </small>
          </div>
          <button
            aria-label="Download image"
            onClick={() => void download()}
            disabled={downloading}
          >
            <Download />
          </button>
          <button
            aria-label="Forward image"
            onClick={() => useUiStore.getState().notify('Forward is coming soon.')}
          >
            <Forward />
          </button>
        </header>
        <button
          className="lightbox-arrow previous"
          aria-label="Previous image"
          disabled={images.length < 2}
          onClick={() => setIndex((value) => (value - 1 + images.length) % images.length)}
        >
          <ArrowLeft />
        </button>
        <div
          className="lightbox-stage"
          onTouchStart={(event) => {
            if (event.touches.length === 2) {
              const [first, second] = Array.from(event.touches);
              pinchStart.current = {
                distance: Math.hypot(
                  first.clientX - second.clientX,
                  first.clientY - second.clientY,
                ),
                zoom,
              };
              pointerStart.current = null;
            } else {
              pointerStart.current = event.touches[0]?.clientX ?? null;
            }
          }}
          onTouchMove={(event) => {
            if (event.touches.length !== 2 || !pinchStart.current) return;
            const [first, second] = Array.from(event.touches);
            const distance = Math.hypot(
              first.clientX - second.clientX,
              first.clientY - second.clientY,
            );
            setZoom(
              Math.min(
                4,
                Math.max(1, (pinchStart.current.zoom * distance) / pinchStart.current.distance),
              ),
            );
          }}
          onTouchEnd={(event) => {
            if (pinchStart.current) {
              if (event.touches.length < 2) pinchStart.current = null;
              return;
            }
            if (pointerStart.current === null) return;
            const delta =
              (event.changedTouches[0]?.clientX ?? pointerStart.current) - pointerStart.current;
            if (Math.abs(delta) > 60 && images.length > 1)
              setIndex((value) => (value + (delta < 0 ? 1 : -1) + images.length) % images.length);
            pointerStart.current = null;
          }}
        >
          {src && (
            <Image
              className={zoomed ? 'lightbox-photo zoomed' : 'lightbox-photo'}
              src={src}
              alt={entry.file_name}
              fill
              sizes="100vw"
              unoptimized
              onClick={() => setZoom((value) => (value > 1 ? 1 : 2))}
              style={{ transform: `scale(${zoom})` }}
            />
          )}
          <span className="lightbox-counter">
            {index + 1} / {images.length}
          </span>
        </div>
        <button
          className="lightbox-arrow next"
          aria-label="Next image"
          disabled={images.length < 2}
          onClick={() => setIndex((value) => (value + 1) % images.length)}
        >
          <ArrowRight />
        </button>
      </section>
    </div>
  );
}
