'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
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
import { AvatarCropDialog } from '../../../components/settings/AvatarCropDialog';

export default function Settings() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const clear = useAuthStore((state) => state.clearSession);
  const notify = useUiStore((state) => state.notify);
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [about, setAbout] = useState('');
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [photoSaving, setPhotoSaving] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);
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
      setCropFile(file);
    } catch {
      notify('Profile photo could not be updated.');
    }
  }
  async function savePhoto() {
    if (!photoFile || !user) return;
    setPhotoSaving(true);
    try {
      const result = await authApi.uploadAvatar(photoFile);
      setUser({ ...user, avatar_url: result.avatar_url });
      setPhotoFile(null);
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setPhotoPreview(null);
      notify('Profile photo updated.');
    } catch {
      notify('Profile photo could not be updated.');
    } finally {
      setPhotoSaving(false);
    }
  }
  async function removePhoto() {
    if (!user) return;
    try {
      await authApi.removeAvatar();
      setUser({ ...user, avatar_url: null });
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setPhotoPreview(null);
      setPhotoFile(null);
      notify('Profile photo removed.');
    } catch {
      notify('Profile photo could not be removed.');
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
        <button
          className="settings-back"
          aria-label="Back to chats"
          onClick={() => router.push('/')}
        >
          <ArrowLeft size={18} />
        </button>
        <h1>Settings</h1>
      </header>
      <section className="settings-section">
        <h2>Profile</h2>
        <div className="settings-profile">
          {user && (
            <UserAvatar user={photoPreview ? { ...user, avatar_url: photoPreview } : user} />
          )}
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
        <div className="photo-upload">
          <span>Update profile photo</span>
          <button
            type="button"
            className="photo-upload-button"
            onClick={() => avatarInput.current?.click()}
          >
            Choose a photo
          </button>
          <input
            ref={avatarInput}
            hidden
            aria-label="Profile photo file"
            type="file"
            accept="image/*"
            onChange={(event) => {
              void updateAvatar(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </div>
        {photoFile && (
          <Button variant="primary" disabled={photoSaving} onClick={() => void savePhoto()}>
            {photoSaving ? 'Saving photo…' : 'Save photo'}
          </Button>
        )}
        {user?.avatar_url && (
          <Button variant="secondary" onClick={() => void removePhoto()}>
            Remove photo
          </Button>
        )}
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
      {cropFile && (
        <AvatarCropDialog
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onApply={(file, preview) => {
            setPhotoFile(file);
            setPhotoPreview(preview);
            setCropFile(null);
          }}
        />
      )}
    </section>
  );
}
