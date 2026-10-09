'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { authApi } from '@/lib/auth';
export default function Register() {
  const [identifier, setIdentifier] = useState('');
  const [busy, setBusy] = useState(false);
  const [wakingUp, setWakingUp] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim()) return;
    setBusy(true);
    setError('');
    try {
      await authApi.requestOtp(identifier.trim(), () => setWakingUp(true));
      sessionStorage.setItem('signal-identifier', identifier.trim());
      router.push('/verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not request code.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="auth-card">
      <Link href="/welcome" className="back-link">
        ← Back
      </Link>
      <h1>Enter your phone number</h1>
      <p>We’ll send you a verification code to get started.</p>
      <form onSubmit={submit}>
        <Input
          label="Phone number or username"
          autoComplete="username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="+91 90000 00001"
          error={error}
        />
        <Button variant="primary" disabled={busy}>
          {wakingUp ? 'Waking up the server…' : busy ? 'Sending…' : 'Continue'}
        </Button>
        {wakingUp && (
          <p className="server-wakeup-note" role="status">
            Waking up the server… Free servers can take up to a minute to respond.
          </p>
        )}
      </form>
      <small>Demo sign-in: +91 90000 00001 or +91 90000 00002</small>
    </section>
  );
}
