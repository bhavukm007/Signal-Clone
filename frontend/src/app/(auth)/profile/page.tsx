'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/ui/Avatar';
import { AvatarCropDialog } from '@/components/settings/AvatarCropDialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { authApi } from '@/lib/auth';
import { useAuthStore } from '@/store/authStore';
import type { User } from '@/types/models';
import { useOverlayStore } from '@/store/overlayStore';

export default function Profile() {
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [cropFile, setCropFile] = useState<File | null>(null);
  const cropOverlay = useOverlayStore((state) => state.primary);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [photoError, setPhotoError] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const trimmedName = name.trim();
  const validName = trimmedName.length >= 2 && trimmedName.length <= 50;

  async function loadProfile() {
    setLoading(true);
    setError('');
    try {
      const user = await authApi.me();
      setCurrentUser(user);
      setName(user.display_name || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Profile could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProfile();
  }, []);

  async function submit(event?: React.FormEvent) {
    event?.preventDefault();
    if (!validName || busy) return;
    setBusy(true);
    setError('');
    setPhotoError(false);
    try {
      const activeUser = await authApi.me();
      setCurrentUser(activeUser);
      let user = await authApi.updateProfile(name.trim());
      setUser(user);
      if (file) {
        try {
          const image = await authApi.uploadAvatar(file);
          user = { ...user, avatar_url: image.avatar_url };
          setUser(user);
        } catch {
          setPhotoError(true);
          setError(
            'Your name is saved, but the photo could not be uploaded. Retry the photo or continue without it.',
          );
          return;
        }
      }
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your profile could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-card">
      <h1>Create your profile</h1>
      <p>Choose the name people will see.</p>
      {loading ? (
        <p role="status">Loading your profile…</p>
      ) : error && !currentUser ? (
        <div role="alert">
          {error}
          <Button onClick={() => void loadProfile()}>Retry</Button>
        </div>
      ) : (
        <form onSubmit={(event) => void submit(event)}>
          <Input
            label="Display name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={50}
            aria-invalid={Boolean(name && !validName)}
            error={name && !validName ? 'Name must contain 2–50 non-blank characters.' : undefined}
          />
          <small className="character-counter" aria-live="polite">
            {trimmedName.length}/50
          </small>
          <div className="profile-photo-picker">
            <span className="field-label">Profile photo (optional)</span>
            <Avatar
              name={name || currentUser?.display_name || 'You'}
              color={currentUser?.avatar_color}
              imageUrl={preview || currentUser?.avatar_url}
              size="normal"
            />
            <label className="secondary-button">
              Choose photo
              <input
                type="file"
                accept="image/*"
                aria-label="Choose profile photo"
                onChange={(event) => {
                  const selected = event.target.files?.[0];
                  if (selected) {
                    setCropFile(selected);
                    useOverlayStore.getState().openPrimary({ kind: 'avatar-crop' });
                  }
                }}
              />
            </label>
            <button
              type="button"
              className="auth-secondary-link"
              onClick={() => {
                setFile(null);
                setPreview('');
              }}
            >
              Skip photo
            </button>
          </div>
          {error && <p role="alert">{error}</p>}
          <Button type="submit" variant="primary" disabled={busy || !validName}>
            {busy ? 'Saving…' : error && !photoError ? 'Try again' : 'Continue to Signal'}
          </Button>
          {photoError && (
            <Button type="button" variant="secondary" onClick={() => router.replace('/')}>
              Continue without photo
            </Button>
          )}
        </form>
      )}
      {cropFile && cropOverlay?.kind === 'avatar-crop' && (
        <AvatarCropDialog
          file={cropFile}
          overlayId={cropOverlay.id}
          onCancel={() => {
            setCropFile(null);
            useOverlayStore.getState().closeTop();
          }}
          onApply={(cropped, url) => {
            setFile(cropped);
            setPreview(url);
            setCropFile(null);
            useOverlayStore.getState().closeTop();
          }}
        />
      )}
    </section>
  );
}
