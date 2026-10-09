'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SignalMark } from '@/components/ui/SignalMark';
export default function Welcome() {
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const value = sessionStorage.getItem('signal-auth-notice');
    if (value) {
      setNotice(value);
      sessionStorage.removeItem('signal-auth-notice');
    }
  }, []);
  return (
    <section className="welcome-card">
      <div className="brand-mark">
        <SignalMark size={42} />
      </div>
      <h1>Signal</h1>
      {notice && <p role="alert">{notice}</p>}
      <p>Say hello to a different messaging experience.</p>
      <Link className="primary-button" href="/register">
        Get started
      </Link>
      <small>Private. Simple. Secure.</small>
    </section>
  );
}
