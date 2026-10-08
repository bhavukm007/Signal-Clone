'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '../../../lib/auth';
import { useAuthStore } from '../../../store/authStore';
import { useUiStore } from '../../../store/uiStore';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { UserAvatar } from '../../../components/ui/Avatar';
import { PrivacySection } from '../../../components/settings/PrivacySection';
import { NotificationsSection } from '../../../components/settings/NotificationsSection';
import { AppearanceSection } from '../../../components/settings/AppearanceSection';
import { ComingSoon } from '../../../components/settings/ComingSoon';

export default function Settings() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const clear = useAuthStore((state) => state.clearSession);
  const notify = useUiStore((state) => state.notify);
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [about, setAbout] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setDisplayName(user?.display_name || '');
    setAbout(user?.about || '');
  }, [user]);

  async function saveProfile() {
    setSaving(true);
    try {
      setUser(await authApi.updateProfile(displayName.trim(), about));
      notify('Profile updated.');
    } catch {
      notify('Profile could not be updated.');
    } finally {
      setSaving(false);
    }
  }
  async function updateAvatar(file: File | undefined) {
    if (!file || !user) return;
    try {
      const result = await authApi.uploadAvatar(file);
      setUser({ ...user, avatar_url: result.avatar_url });
      notify('Profile photo updated.');
    } catch {
      notify('Profile photo could not be updated.');
    }
  }
  async function logout() {
    try {
      await authApi.logout();
    } finally {
      clear();
      router.replace('/welcome');
    }
  }

  return (
    <section className="settings-page">
      <header>
        <h1>Settings</h1>
      </header>
      <section className="settings-section">
        <h2>Profile</h2>
        <div className="settings-profile">
          {user && <UserAvatar user={user} />}
          <div>
            <b>{user?.display_name}</b>
            <small>{user?.phone_number || user?.username}</small>
          </div>
        </div>
        <Input
          label="Display name"
          value={displayName}
          maxLength={80}
          onChange={(event) => setDisplayName(event.target.value)}
        />
        <Input
          label="About"
          value={about}
          maxLength={140}
          onChange={(event) => setAbout(event.target.value)}
        />
        <label className="photo-upload">
          Update profile photo
          <input
            type="file"
            accept="image/*"
            onChange={(event) => void updateAvatar(event.target.files?.[0])}
          />
        </label>
        <Button
          variant="primary"
          disabled={!displayName.trim() || saving}
          onClick={() => void saveProfile()}
        >
          {saving ? 'Saving…' : 'Save profile'}
        </Button>
      </section>
      <PrivacySection />
      <NotificationsSection />
      <AppearanceSection />
      <section className="settings-section">
        <h2>More</h2>
        <ComingSoon name="Linked devices" />
        <ComingSoon name="Stories" />
        <ComingSoon name="Calls" />
      </section>
      <Button variant="danger" onClick={() => void logout()}>
        Log out
      </Button>
    </section>
  );
}
