'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { authApi } from '@/lib/auth';
import { normalizePhoneOrUsername } from '@/lib/phone';
export default function Register() {
  const [identifier, setIdentifier] = useState('');
  const [busy, setBusy] = useState(false);
  const [wakingUp, setWakingUp] = useState(false);
  const [error, setError] = useState('');
  const [usernameMode, setUsernameMode] = useState(false);
  const router = useRouter();
  const formattedDigits = identifier
    .replace(/\D/gu, '')
    .replace(/^91(?=\d{10}$)/u, '')
    .replace(/^0(?=\d{10}$)/u, '');
  const phoneValid = /^[6-9]\d{9}$/u.test(formattedDigits);
  const usernameValid = /^[a-zA-Z0-9_]{3,32}$/u.test(identifier.trim());
  const canContinue = usernameMode ? usernameValid : phoneValid;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canContinue) {
      setError(
        usernameMode
          ? 'Use 3–32 letters, numbers or underscores.'
          : 'Enter a valid 10-digit Indian mobile number.',
      );
      return;
    }
    const normalized = usernameMode ? identifier.trim() : normalizePhoneOrUsername(formattedDigits);
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
        {usernameMode ? (
          <Input
            label="Username"
            autoComplete="username"
            value={identifier}
            onChange={(event) => {
              setIdentifier(event.target.value);
              setError('');
            }}
            onBlur={() => {
              if (identifier && !usernameValid)
                setError('Use 3–32 letters, numbers or underscores.');
            }}
            placeholder="Username"
            error={error}
          />
        ) : (
          <div className="input-field">
            <span className="field-label">Phone number</span>
            <div className="phone-entry">
              <span className="phone-prefix" aria-label="Country code India">
                +91
              </span>
              <input
                id="phone-number"
                className="text-input"
                aria-label="Phone number"
                aria-invalid={Boolean(error)}
                autoComplete="tel-national"
                inputMode="numeric"
                value={identifier}
                onChange={(event) => {
                  const raw = event.target.value;
                  if (/[a-z]/iu.test(raw)) {
                    setError('Use digits only.');
                    return;
                  }
                  const digits = raw
                    .replace(/\D/gu, '')
                    .replace(/^91(?=\d{10}$)/u, '')
                    .replace(/^0(?=\d{10}$)/u, '')
                    .slice(0, 10);
                  setIdentifier(
                    digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits,
                  );
                  setError('');
                }}
                onBlur={() => {
                  if (identifier && !phoneValid)
                    setError('Enter a valid 10-digit Indian mobile number starting with 6–9.');
                }}
                placeholder="90000 00001"
              />
            </div>
            {error && (
              <span className="input-error" role="alert">
                {error}
              </span>
            )}
          </div>
        )}
        <Button type="submit" variant="primary" disabled={busy || !canContinue}>
          {wakingUp ? 'Waking up the server…' : busy ? 'Sending…' : 'Continue'}
        </Button>
        <button
          type="button"
          className="auth-secondary-link"
          onClick={() => {
            setUsernameMode((value) => !value);
            setIdentifier('');
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
