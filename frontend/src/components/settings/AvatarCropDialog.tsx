'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

export function AvatarCropDialog({
  file,
  onCancel,
  onApply,
}: {
  file: File;
  onCancel: () => void;
  onApply: (file: File, previewUrl: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const image = useRef<HTMLImageElement | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [sourceUrl] = useState(() => URL.createObjectURL(file));
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const photo = new Image();
    photo.onload = () => {
      image.current = photo;
      setLoaded(true);
    };
    photo.onerror = () => setError('This photo could not be opened.');
    photo.src = sourceUrl;
    return () => URL.revokeObjectURL(sourceUrl);
  }, [sourceUrl]);

  const draw = useCallback(() => {
    const photo = image.current;
    const target = canvas.current;
    const context = target?.getContext('2d');
    if (!photo || !target || !context) return;
    const side = Math.min(photo.naturalWidth, photo.naturalHeight) / zoom;
    const centerX = photo.naturalWidth / 2 + offset.x;
    const centerY = photo.naturalHeight / 2 + offset.y;
    const sx = Math.max(0, Math.min(photo.naturalWidth - side, centerX - side / 2));
    const sy = Math.max(0, Math.min(photo.naturalHeight - side, centerY - side / 2));
    context.clearRect(0, 0, target.width, target.height);
    context.drawImage(photo, sx, sy, side, side, 0, 0, target.width, target.height);
  }, [offset, zoom]);

  useEffect(() => draw(), [draw]);

  async function apply() {
    const output = canvas.current;
    if (!output) return;
    setSaving(true);
    output.toBlob(
      (blob) => {
        if (!blob) {
          setError('The cropped photo could not be saved.');
          setSaving(false);
          return;
        }
        const isPng = file.type === 'image/png';
        const base = file.name.replace(/\.[^.]+$/u, '') || 'profile-photo';
        const result = new File([blob], `${base}.${isPng ? 'png' : 'jpg'}`, {
          type: isPng ? 'image/png' : 'image/jpeg',
        });
        onApply(result, URL.createObjectURL(blob));
        setSaving(false);
      },
      file.type === 'image/png' ? 'image/png' : 'image/jpeg',
      0.92,
    );
  }

  return (
    <Modal title="Crop profile photo" onClose={onCancel}>
      <div className="avatar-cropper">
        <canvas
          ref={canvas}
          width={512}
          height={512}
          aria-label="Profile photo crop preview"
          onPointerDown={(event) => {
            drag.current = { x: event.clientX, y: event.clientY };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!drag.current || !image.current) return;
            const rect = event.currentTarget.getBoundingClientRect();
            const factor =
              Math.min(image.current.naturalWidth, image.current.naturalHeight) / zoom / rect.width;
            setOffset((value) => ({
              x: value.x - (event.clientX - drag.current!.x) * factor,
              y: value.y - (event.clientY - drag.current!.y) * factor,
            }));
            drag.current = { x: event.clientX, y: event.clientY };
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
        />
        <label>
          Zoom
          <input
            type="range"
            min="1"
            max="3"
            step="0.05"
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
        </label>
        <small>Drag the image to adjust the crop.</small>
        {error && <p role="alert">{error}</p>}
        <div className="avatar-crop-actions">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" disabled={saving || !loaded} onClick={() => void apply()}>
            {saving ? 'Preparing…' : 'Use photo'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
