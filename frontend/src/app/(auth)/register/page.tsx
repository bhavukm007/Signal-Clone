'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { authApi } from '@/lib/auth';
import { normalizePhoneNumber, normalizePhoneOrUsername } from '@/lib/phone';
export default function Register() {
  const [identifier, setIdentifier] = useState('');
  const [busy, setBusy] = useState(false);
  const [wakingUp, setWakingUp] = useState(false);
  const [error, setError] = useState('');
  const [usernameMode, setUsernameMode] = useState(false);
  const router = useRouter();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim()) return;
    const numberLike = /^[+\d\s().-]+$/u.test(identifier.trim());
    const canonical = normalizePhoneNumber(identifier);
    if (!usernameMode && numberLike && !canonical) {
      setError('Enter a valid phone number.');
      return;
    }
    const normalized = usernameMode ? identifier.trim() : normalizePhoneOrUsername(identifier);
    setBusy(true);
    setError('');
    try {
      const result = await authApi.requestOtp(normalized, () => setWakingUp(true));
      sessionStorage.setItem('signal-identifier', normalized);
      sessionStorage.setItem('signal-demo-code', result.demo_code);
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
          inputMode={usernameMode ? 'text' : 'tel'}
          value={identifier}
          onChange={(e) => {
            const value = e.target.value;
            setIdentifier(value);
            const numberLike = /^[+\d\s().-]+$/u.test(value.trim());
            setError(
              !usernameMode &&
                numberLike &&
                value.trim().length >= 8 &&
                !normalizePhoneNumber(value)
                ? 'Enter a valid phone number.'
                : '',
            );
          }}
          placeholder={usernameMode ? 'Username' : '+91 90000 00001'}
          error={error}
        />
        <Button type="submit" variant="primary" disabled={busy || !identifier.trim()}>
          {wakingUp
            ? 'Waking up the server…'
            : busy
              ? 'Sending…'
              : error
                ? 'Try again'
                : 'Continue'}
        </Button>
        <button
          type="button"
          className="auth-secondary-link"
          onClick={() => {
            setUsernameMode((value) => !value);
            setError('');
          }}
        >
          {usernameMode ? 'Use a phone number instead' : 'Use a username instead'}
        </button>
        {wakingUp && (
          <p className="server-wakeup-note" role="status">
            Waking up the server… Free servers can take up to a minute to respond.
          </p>
        )}
      </form>
      <small>Demo sign-in: +919000000001 or +919000000002</small>
    </section>
  );
}
