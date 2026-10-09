export interface ContactName {
  id: string;
  display_name: string;
}

export interface ContactGroup<T> {
  letter: string;
  contacts: T[];
}

export const CONTACT_ALPHABET = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'];

export function normalizeContactText(value: string, locale?: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase(locale);
}

export function contactGroupLetter(name: string, locale?: string): string {
  const first = Array.from(normalizeContactText(name.trim(), locale))[0] ?? '';
  return /^[a-z]$/u.test(first) ? first.toLocaleUpperCase(locale) : '#';
}

export function sortAndGroupContacts<T extends ContactName>(
  contacts: readonly T[],
  locale?: string,
): ContactGroup<T>[] {
  const collator = new Intl.Collator(locale, {
    usage: 'sort',
    sensitivity: 'base',
    numeric: true,
  });
  const groups = new Map<string, T[]>();
  for (const contact of contacts) {
    const letter = contactGroupLetter(contact.display_name, locale);
    const group = groups.get(letter) ?? [];
    group.push(contact);
    groups.set(letter, group);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => {
      if (left === '#') return 1;
      if (right === '#') return -1;
      return collator.compare(left, right);
    })
    .map(([letter, group]) => ({
      letter,
      contacts: group.sort(
        (left, right) =>
          collator.compare(left.display_name, right.display_name) ||
          left.id.localeCompare(right.id, locale),
      ),
    }));
}

export function matchesContactQuery(
  contact: { display_name: string; phone_number?: string | null; username?: string | null },
  query: string,
  locale?: string,
): boolean {
  const needle = normalizeContactText(query.trim(), locale);
  if (!needle) return true;
  return [contact.display_name, contact.phone_number ?? '', contact.username ?? ''].some((value) =>
    normalizeContactText(value, locale).includes(needle),
  );
}
