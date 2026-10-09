'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { authApi } from '@/lib/auth';
import { formatPhoneNumber } from '@/lib/phone';
import { useAuthStore } from '@/store/authStore';

export default function Verify() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [wakingUp, setWakingUp] = useState(false);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const identifier =
    typeof window === 'undefined' ? '' : sessionStorage.getItem('signal-identifier') || '';
  const demoCode =
    typeof window === 'undefined' ? '' : sessionStorage.getItem('signal-demo-code') || '';

  async function verify(value: string) {
    if (value.length !== 6 || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await authApi.verifyOtp(identifier, value, () => setWakingUp(true));
      setSession(result.token, result.user);
      router.replace(result.is_new_user ? '/profile' : '/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Code could not be verified.');
      setCode('');
      inputs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  }

  function update(index: number, raw: string) {
    const digits = raw.replace(/\D/gu, '');
    const next = (code.slice(0, index) + digits + code.slice(index + 1)).slice(0, 6);
    setCode(next);
    if (digits) inputs.current[Math.min(index + digits.length, 5)]?.focus();
    if (next.length === 6) void verify(next);
  }

  return (
    <section className="auth-card">
      <h1>Enter verification code</h1>
      <p>We’ll verify {formatPhoneNumber(identifier)}.</p>
      {demoCode && <p role="note">Demo mode: no SMS is sent. Enter {demoCode}.</p>}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void verify(code);
        }}
      >
        <div className="otp-boxes" aria-label="Six digit verification code">
          {Array.from({ length: 6 }, (_, index) => (
            <input
              key={index}
              ref={(element) => {
                inputs.current[index] = element;
              }}
              aria-label={`Digit ${index + 1}`}
              inputMode="numeric"
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              maxLength={index === 0 ? 6 : 1}
              value={code[index] ?? ''}
              onChange={(event) => update(index, event.target.value)}
              onPaste={(event) => {
                event.preventDefault();
                const pasted = event.clipboardData.getData('text').replace(/\D/gu, '').slice(0, 6);
                setCode(pasted);
                if (pasted.length === 6) void verify(pasted);
                else inputs.current[pasted.length]?.focus();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Backspace' && !code[index] && index > 0)
                  inputs.current[index - 1]?.focus();
                if (event.key === 'ArrowLeft' && index > 0) inputs.current[index - 1]?.focus();
                if (event.key === 'ArrowRight' && index < 5) inputs.current[index + 1]?.focus();
              }}
              disabled={busy}
            />
          ))}
        </div>
        {error && <p role="alert">{error}</p>}
        <Button type="submit" variant="primary" disabled={busy || code.length !== 6}>
          {wakingUp
            ? 'Waking up the server…'
            : busy
              ? 'Verifying…'
              : error
                ? 'Try again'
                : 'Continue'}
        </Button>
        {wakingUp && (
          <p className="server-wakeup-note" role="status">
            Waking up the server… Free servers can take up to a minute to respond.
          </p>
        )}
      </form>
    </section>
  );
}
