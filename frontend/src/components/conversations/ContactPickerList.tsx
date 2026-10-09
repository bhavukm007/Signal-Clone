'use client';

import { useMemo, useRef, type KeyboardEvent, type RefObject } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { CONTACT_ALPHABET, normalizeContactText, sortAndGroupContacts } from '@/lib/contacts';
import type { User } from '@/types/models';

export interface PickerPerson extends User {
  is_contact: boolean;
}

function Highlight({ text, query }: { text: string; query: string }) {
  const chars = Array.from(text);
  const normalizedParts = chars.map((char) => Array.from(normalizeContactText(char)));
  const normalizedText = normalizedParts.flat().join('');
  const normalizedQuery = normalizeContactText(query.trim());
  const start = normalizedQuery ? normalizedText.indexOf(normalizedQuery) : -1;
  if (start < 0) return text;
  const originalIndexes = normalizedParts.flatMap((part, index) => part.map(() => index));
  const first = originalIndexes[start];
  const last = originalIndexes[start + normalizedQuery.length - 1] + 1;
  return (
    <>
      {chars.slice(0, first).join('')}
      <mark className="contact-match">{chars.slice(first, last).join('')}</mark>
      {chars.slice(last).join('')}
    </>
  );
}

export function ContactPickerList({
  contacts,
  query,
  selectedIds = [],
  onChoose,
  onToggle,
  onProfile,
  listRef,
}: {
  contacts: PickerPerson[];
  query: string;
  selectedIds?: string[];
  onChoose?: (contact: PickerPerson) => void;
  onToggle?: (contact: PickerPerson, checked: boolean) => void;
  onProfile?: (contact: PickerPerson) => void;
  listRef?: RefObject<HTMLDivElement>;
}) {
  const internalRef = useRef<HTMLDivElement>(null);
  const containerRef = listRef ?? internalRef;
  const groups = useMemo(() => sortAndGroupContacts(contacts), [contacts]);
  function navigate(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const items = Array.from(
      containerRef.current?.querySelectorAll<HTMLElement>('[data-picker-item]') ?? [],
    );
    if (!items.length) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLElement);
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    const next =
      current < 0
        ? direction > 0
          ? 0
          : items.length - 1
        : (current + direction + items.length) % items.length;
    items[next]?.focus();
  }

  if (!groups.length)
    return (
      <div className="contact-picker-empty" role="status">
        No contacts found
      </div>
    );

  const presentLetters = new Set(groups.map((group) => group.letter));
  return (
    <div className="contact-picker-wrap">
      <div className="contact-picker-scroll" id="contact-picker-scroll" ref={containerRef}>
        {groups.map(({ letter, contacts: group }) => (
          <section className="contact-picker-group" key={letter}>
            <h3 className="contact-group-title" id={`contact-group-${letter}`}>
              {letter}
            </h3>
            {group.map((person) => {
              const secondary =
                person.about?.trim() || person.phone_number || person.username || '';
              return onToggle ? (
                <div className="contact-picker-row selectable" key={person.id} onKeyDown={navigate}>
                  <input
                    type="checkbox"
                    data-picker-item
                    aria-label={`Select ${person.display_name}`}
                    checked={selectedIds.includes(person.id)}
                    onChange={(event) => onToggle(person, event.target.checked)}
                  />
                  <button
                    className="picker-avatar-button"
                    type="button"
                    aria-label={`Open ${person.display_name} profile`}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onProfile?.(person);
                    }}
                  >
                    <Avatar
                      name={person.display_name}
                      color={person.avatar_color}
                      imageUrl={person.avatar_url}
                    />
                  </button>
                  <span className="contact-picker-copy">
                    <b>
                      <Highlight text={person.display_name} query={query} />
                    </b>
                    <small>{secondary}</small>
                  </span>
                </div>
              ) : (
                <button
                  className="contact-picker-row"
                  data-picker-item
                  key={person.id}
                  onClick={() => onChoose?.(person)}
                  onKeyDown={navigate}
                >
                  <span
                    role="button"
                    tabIndex={0}
                    className="picker-avatar-button"
                    aria-label={`Open ${person.display_name} profile`}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onProfile?.(person);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        event.stopPropagation();
                        onProfile?.(person);
                      }
                    }}
                  >
                    <Avatar
                      name={person.display_name}
                      color={person.avatar_color}
                      imageUrl={person.avatar_url}
                    />
                  </span>
                  <span className="contact-picker-copy">
                    <b>
                      <Highlight text={person.display_name} query={query} />
                    </b>
                    <small>
                      <Highlight text={secondary} query={query} />
                    </small>
                  </span>
                </button>
              );
            })}
          </section>
        ))}
      </div>
      <nav className="contact-alphabet-index" aria-label="Contact letter index">
        {CONTACT_ALPHABET.map((letter) => (
          <button
            key={letter}
            type="button"
            aria-label={`Jump to ${letter}`}
            disabled={!presentLetters.has(letter)}
            onClick={() =>
              containerRef.current
                ?.querySelector<HTMLElement>(`#contact-group-${letter}`)
                ?.scrollIntoView({ block: 'start' })
            }
          >
            {letter}
          </button>
        ))}
      </nav>
    </div>
  );
}
