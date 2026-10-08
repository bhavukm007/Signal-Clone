'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/Spinner';
import { authApi } from '@/lib/auth';
import { useAuthStore } from '@/store/authStore';
import { WebSocketProvider } from '@/hooks/useWebSocket';
import { Sidebar } from './Sidebar';
import { NewChatModal } from '@/components/conversations/NewChatModal';

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { token, user, hydrated, setUser } = useAuthStore();
  useEffect(() => {
    if (!hydrated) return;
    if (!token) { router.replace('/welcome'); return; }
    if (!user) void authApi.me().then(setUser).catch(() => router.replace('/welcome'));
  }, [hydrated, token, user, setUser, router]);
  if (!hydrated || (token && !user)) return <main className="loading-screen"><Spinner /></main>;
  if (!token || !user) return null;
  return <WebSocketProvider><div className="app-shell"><Sidebar /><main className="app-main">{children}</main></div><NewChatModal/></WebSocketProvider>;
}
