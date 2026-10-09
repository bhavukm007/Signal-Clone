'use client';
import Image from 'next/image';
import { Download, FileText } from 'lucide-react';
import { useState } from 'react';
import { useMediaObjectUrl } from '@/hooks/useMediaObjectUrl';
import { downloadMedia } from '@/lib/downloadMedia';
import { formatFileSize } from '@/lib/formatters';
import { useUiStore } from '@/store/uiStore';
import type { Attachment } from '@/types/models';

export function AuthenticatedAttachment({
  attachment,
  onPreview,
}: {
  attachment: Attachment;
  onPreview: (attachmentId: string) => void;
}) {
  const url = useMediaObjectUrl(attachment.url);
  const [downloading, setDownloading] = useState(false);
  async function download() {
    setDownloading(true);
    try {
      await downloadMedia(attachment.url, attachment.file_name);
    } catch {
      useUiStore.getState().notify('The attachment could not be downloaded.');
    } finally {
      setDownloading(false);
    }
  }
  if (!url) return <span className="media-loading">Loading attachment…</span>;
  return attachment.mime_type.startsWith('image/') ? (
    <div className="image-attachment">
      <button className="image-preview-button" onClick={() => onPreview(attachment.id)}>
        <Image
          src={url}
          alt={attachment.file_name}
          width={360}
          height={240}
          unoptimized
          loading="lazy"
        />
      </button>
      <button
        className="attachment-download"
        aria-label={`Download ${attachment.file_name}`}
        disabled={downloading}
        onClick={() => void download()}
      >
        <Download size={17} />
      </button>
      <span>{attachment.file_name}</span>
    </div>
  ) : (
    <div className="file-attachment">
      <FileText size={20} aria-hidden="true" />
      <span className="file-attachment-copy">
        <b>{attachment.file_name}</b>
        <small>{formatFileSize(attachment.size_bytes)}</small>
      </span>
      <button
        aria-label={`Download ${attachment.file_name}`}
        disabled={downloading}
        onClick={() => void download()}
      >
        {downloading ? 'Saving…' : <Download size={17} />}
      </button>
    </div>
  );
}
