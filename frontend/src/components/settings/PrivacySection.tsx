'use client';
import { Switch } from '@/components/ui/Switch';
import { usePreferencesStore } from '@/store/preferencesStore';

export function PrivacySection() {
  const readReceipts = usePreferencesStore((state) => state.readReceipts);
  const typingIndicators = usePreferencesStore((state) => state.typingIndicators);
  const set = usePreferencesStore((state) => state.setPreference);
  return (
    <section className="settings-section">
      <h2>Privacy</h2>
      <label className="setting-row">
        <span>
          Read receipts<small>Let others know when you’ve read their messages</small>
        </span>
        <Switch
          label="Read receipts"
          checked={readReceipts}
          onChange={(value) => set('readReceipts', value)}
        />
      </label>
      <label className="setting-row">
        <span>
          Typing indicators<small>Show when you’re typing</small>
        </span>
        <Switch
          label="Typing indicators"
          checked={typingIndicators}
          onChange={(value) => set('typingIndicators', value)}
        />
      </label>
      <p className="settings-link">
        Blocked users <span>Manage</span>
      </p>
    </section>
  );
}
