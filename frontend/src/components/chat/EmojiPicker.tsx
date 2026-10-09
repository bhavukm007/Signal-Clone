'use client';

import { useMemo, useState, type CSSProperties, type KeyboardEvent } from 'react';

const categories = [
  { id: 'recent', label: 'Recently used', icon: '◷', items: [] as string[] },
  {
    id: 'smileys',
    label: 'Smileys',
    icon: '😊',
    items:
      '😀 😃 😄 😁 😆 😅 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😋 😛 🤔 🤗 🤭 🫡 🤫 😴 😎 🥳 😭 😢 😮 😡'.split(
        ' ',
      ),
  },
  {
    id: 'people',
    label: 'People',
    icon: '👋',
    items:
      '👋 🤚 🖐️ ✋ 🫶 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 👇 👍 👎 ✊ 👏 🙌 👐 🤲 🙏 💪 🧑 👩 👨 🧑‍🤝‍🧑'.split(
        ' ',
      ),
  },
  {
    id: 'nature',
    label: 'Nature',
    icon: '🌿',
    items: '🐶 🐱 🐭 🐰 🦊 🐻 🐼 🐸 🐵 🦄 🐝 🦋 🐢 🐬 🐳 🌸 🌹 🌻 🌈 ⭐ 🌙 ☀️ 🔥 🍀'.split(' '),
  },
  {
    id: 'food',
    label: 'Food',
    icon: '🍎',
    items: '🍎 🍊 🍋 🍉 🍇 🍓 🫐 🍒 🍑 🥑 🍕 🍔 🍟 🌮 🍜 🍰 🎂 ☕ 🧋 🥤'.split(' '),
  },
  {
    id: 'activities',
    label: 'Activities',
    icon: '⚽',
    items: '⚽ 🏀 🏈 ⚾ 🎾 🏐 🎱 🏓 🏸 🥊 🏆 🎮 🎯 🎨 🎸 🎤 🎧 🎉 🎊'.split(' '),
  },
  {
    id: 'travel',
    label: 'Travel',
    icon: '🚗',
    items: '🚗 🚕 🚌 🚎 🚑 🚲 🛵 ✈️ 🚀 🚁 🚂 🚆 🛳️ ⛵ 🏠 🏖️ 🏔️ 🗽 🌍'.split(' '),
  },
  {
    id: 'symbols',
    label: 'Symbols',
    icon: '💙',
    items: '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 💕 💞 💯 ✅ ❌ ⚠️ 💬 🔔 🔒 ♻️'.split(' '),
  },
];
const tones = ['🏻', '🏼', '🏽', '🏾', '🏿'];
const toneable = new Set(
  '👋 🤚 🖐️ ✋ 🫶 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 👇 👍 👎 ✊ 👏 🙌 👐 🤲 🙏 💪'.split(' '),
);
const names: Record<string, string> = {
  '😀': 'grinning face',
  '😂': 'face with tears of joy',
  '❤️': 'red heart',
  '👍': 'thumbs up',
  '🙏': 'folded hands',
  '🎉': 'party popper',
  '🔥': 'fire',
  '😢': 'crying face',
  '😮': 'surprised face',
  '😊': 'smiling face',
  '🥰': 'smiling face hearts',
  '🤔': 'thinking face',
  '👋': 'waving hand',
  '🍕': 'pizza',
  '☕': 'coffee',
  '🌸': 'cherry blossom',
  '💙': 'blue heart',
  '👏': 'clapping hands',
};

function recentEmojis(): string[] {
  try {
    const stored = localStorage.getItem('signal-recent-emojis');
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string').slice(0, 24)
      : [];
  } catch {
    return [];
  }
}

export default function EmojiPicker({
  onSelect,
  className = '',
  style,
}: {
  onSelect: (emoji: string) => void;
  className?: string;
  style?: CSSProperties;
}) {
  const [category, setCategory] = useState('smileys');
  const [query, setQuery] = useState('');
  const [tone, setTone] = useState('');
  const [recent, setRecent] = useState<string[]>(recentEmojis);
  const list = useMemo(() => {
    if (query.trim()) {
      const search = query.trim().toLocaleLowerCase();
      return categories
        .flatMap((section) => section.items)
        .filter((emoji) => `${emoji} ${names[emoji] ?? ''}`.toLocaleLowerCase().includes(search));
    }
    const selected = categories.find((item) => item.id === category);
    return selected?.id === 'recent' ? recent : (selected?.items ?? []);
  }, [category, query, recent]);

  function choose(base: string) {
    const emoji = tone && toneable.has(base) ? `${base.replace(/[🏻-🏿]/u, '')}${tone}` : base;
    const updated = [emoji, ...recent.filter((item) => item !== emoji)].slice(0, 24);
    setRecent(updated);
    try {
      localStorage.setItem('signal-recent-emojis', JSON.stringify(updated));
    } catch {
      // Recent emojis are a convenience; selecting an emoji still works when storage is unavailable.
    }
    onSelect(emoji);
  }

  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(event.key)) return;
    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-emoji-option]'),
    );
    const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (currentIndex < 0) return;
    event.preventDefault();
    const columns = 8;
    const delta =
      event.key === 'ArrowRight'
        ? 1
        : event.key === 'ArrowLeft'
          ? -1
          : event.key === 'ArrowDown'
            ? columns
            : -columns;
    buttons[(currentIndex + delta + buttons.length) % buttons.length]?.focus();
  }

  return (
    <section
      className={`emoji-picker-panel ${className}`}
      style={style}
      aria-label="Emoji picker"
      onKeyDown={navigate}
    >
      <label className="emoji-picker-search">
        <span aria-hidden="true">⌕</span>
        <input
          aria-label="Search emoji"
          placeholder="Search emoji"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="emoji-picker-tabs" role="tablist" aria-label="Emoji categories">
        {categories.map((item) => (
          <button
            type="button"
            role="tab"
            aria-selected={category === item.id && !query}
            aria-label={item.label}
            key={item.id}
            onClick={() => {
              setQuery('');
              setCategory(item.id);
            }}
          >
            {item.icon}
          </button>
        ))}
      </div>
      <div className="emoji-picker-tones" aria-label="Skin tone">
        <button
          type="button"
          aria-label="Default skin tone"
          aria-pressed={!tone}
          onClick={() => setTone('')}
        >
          ●
        </button>
        {tones.map((item, index) => (
          <button
            type="button"
            key={item}
            aria-label={`Skin tone ${index + 1}`}
            aria-pressed={tone === item}
            onClick={() => setTone(item)}
          >
            👋{item}
          </button>
        ))}
      </div>
      <div
        className="emoji-picker-grid"
        role="tabpanel"
        aria-label={
          query ? 'Search results' : categories.find((item) => item.id === category)?.label
        }
      >
        {list.length ? (
          list.map((emoji, index) => (
            <button
              type="button"
              data-emoji-option
              key={`${emoji}-${index}`}
              aria-label={`${names[emoji] ?? emoji} ${emoji}`}
              onClick={() => choose(emoji)}
            >
              {emoji}
            </button>
          ))
        ) : (
          <p role="status">No emoji found</p>
        )}
      </div>
    </section>
  );
}
