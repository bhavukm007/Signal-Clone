const separators = /[\s().-]/gu;

export function normalizePhoneNumber(value: string): string | null {
  const compact = value.trim().replace(separators, '');
  if (!compact || !/^\+?\d+$/u.test(compact)) return null;
  let digits = compact.startsWith('+') ? compact.slice(1) : compact;
  if (!compact.startsWith('+') && digits.length === 10) digits = `91${digits}`;
  if (
    digits.length < 8 ||
    digits.length > 15 ||
    digits.startsWith('0') ||
    (digits.startsWith('91') && digits.length === 12 && digits[2] === '0')
  )
    return null;
  return `+${digits}`;
}

export function normalizePhoneOrUsername(value: string): string {
  const trimmed = value.trim();
  return normalizePhoneNumber(trimmed) ?? trimmed;
}

export function formatPhoneNumber(value: string): string {
  const canonical = normalizePhoneNumber(value);
  if (!canonical) return value;
  const digits = canonical.slice(1);
  if (digits.startsWith('91') && digits.length === 12)
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  return canonical;
}
