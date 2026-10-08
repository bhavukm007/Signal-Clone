'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/auth';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
export default function Profile() {
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      let user = await authApi.updateProfile(name);
      if (file) {
        const image = await authApi.uploadAvatar(file);
        user = { ...user, avatar_url: image.avatar_url };
      }
      setUser(user);
      router.replace('/');
    } catch {}
  }
  return (
    <section className="auth-card">
      <h1>Create your profile</h1>
      <p>Choose the name people will see.</p>
      <form onSubmit={submit}>
        <Input
          label="Display name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={80}
        />
        <label className="input-field">
          <span className="field-label">Profile photo</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <Button variant="primary" disabled={!name.trim()}>
          Continue to Signal
        </Button>
      </form>
    </section>
  );
}
