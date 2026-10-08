'use client';
import { useUiStore, type ThemeMode } from '@/store/uiStore';

export function AppearanceSection() {
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);
  return (
    <section className="settings-section">
      <h2>Appearance</h2>
      <label className="setting-row">
        <span>
          Theme<small>Choose a light or dark appearance</small>
        </span>
        <select
          aria-label="Theme"
          value={theme}
          onChange={(event) => setTheme(event.target.value as ThemeMode)}
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
    </section>
  );
}
