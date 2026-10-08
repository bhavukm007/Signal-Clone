'use client';
import { Switch } from '@/components/ui/Switch';
import { usePreferencesStore } from '@/store/preferencesStore';

export function NotificationsSection() {
  const notifications = usePreferencesStore((state) => state.messageNotifications);
  const sound = usePreferencesStore((state) => state.notificationSound);
  const set = usePreferencesStore((state) => state.setPreference);
  return (
    <section className="settings-section">
      <h2>Notifications</h2>
      <label className="setting-row">
        <span>
          Message notifications<small>Show an in-app toast when a new message arrives</small>
        </span>
        <Switch
          label="Message notifications"
          checked={notifications}
          onChange={(value) => set('messageNotifications', value)}
        />
      </label>
      <label className="setting-row">
        <span>
          Notification sound<small>Sound support is not included in this demo</small>
        </span>
        <Switch
          label="Notification sound"
          checked={sound}
          onChange={(value) => set('notificationSound', value)}
        />
      </label>
    </section>
  );
}
