import { differenceInCalendarDays, format, isToday, isYesterday } from 'date-fns';
import type { Attachment } from '@/types/models';

export function fullTime(value: string): string {
  return format(new Date(value), 'p');
}

export function lastSeenTime(value: string): string {
  return format(new Date(value), 'MMM d, h:mm a');
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
