import { differenceInCalendarDays, format, isToday, isYesterday } from 'date-fns';

export function fullTime(value: string): string {
  return format(new Date(value), 'p');
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
