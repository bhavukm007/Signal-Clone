'use client';
import Image from 'next/image';
import { useMediaObjectUrl } from '@/hooks/useMediaObjectUrl';
import type { Attachment } from '@/types/models';

export function AuthenticatedAttachment({
  attachment,
  onPreview,
}: {
  attachment: Attachment;
  onPreview: (url: string) => void;
}) {
  const url = useMediaObjectUrl(attachment.url);
  if (!url) return <span className="media-loading">Loading attachment…</span>;
  return attachment.mime_type.startsWith('image/') ? (
    <button className="image-attachment" onClick={() => onPreview(attachment.url)}>
      <Image src={url} alt={attachment.file_name} width={360} height={240} unoptimized />
      <span>{attachment.file_name}</span>
    </button>
  ) : (
    <a className="file-attachment" href={url} download={attachment.file_name}>
      📎 {attachment.file_name}
    </a>
  );
}
