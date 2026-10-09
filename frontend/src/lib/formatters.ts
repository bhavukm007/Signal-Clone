import { differenceInCalendarDays, format, isToday, isYesterday } from 'date-fns';
import type { Attachment } from '@/types/models';

export function fullTime(value: string): string {
  return format(new Date(value), 'p');
}

export function lastSeenTime(value: string): string {
  return format(new Date(value), 'MMM d, h:mm a');
}

export function formatPhoneNumber(value: string | null | undefined): string {
  if (!value) return '';
  const digits = value.replace(/\D/gu, '');
  if (digits.length === 12 && digits.startsWith('91'))
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  return value.startsWith('+') ? value : `+${digits}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function messagePreviewText(body: string, attachments: readonly Attachment[]): string {
  if (body.trim()) return body;
  const first = attachments[0];
  if (!first) return 'Start a conversation';
  return first.mime_type.startsWith('image/') ? 'Photo' : `📎 ${first.file_name}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '?'
  );
}

export function dayLabel(value: string): string {
  const date = new Date(value);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMMM d, yyyy');
}

export function conversationTime(value: string): string {
  const date = new Date(value);
  const daysAgo = differenceInCalendarDays(new Date(), date);
  if (daysAgo === 0) return format(date, 'p');
  if (daysAgo === 1) return 'Yesterday';
  if (daysAgo < 7) return format(date, 'EEE');
  return format(date, 'MMM d');
}
