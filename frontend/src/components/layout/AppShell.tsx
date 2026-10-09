'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { Spinner } from '@/components/ui/Spinner';
import { authApi } from '@/lib/auth';
import { useAuthStore } from '@/store/authStore';
import { WebSocketProvider } from '@/hooks/useWebSocket';
import { Sidebar } from './Sidebar';
import { NewChatModal } from '@/components/conversations/NewChatModal';
import { GroupInfoPanel } from '@/components/groups/GroupInfoPanel';
import { useChatStore } from '@/store/chatStore';
import { usePresenceStore } from '@/store/presenceStore';
import { ContactProfilePanel } from '@/components/contacts/ContactProfilePanel';
import { AttachmentLightbox } from '@/components/chat/AttachmentLightbox';
import { useOverlayStore } from '@/store/overlayStore';

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { token, user, hydrated, setUser } = useAuthStore();
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const connectionStatus = usePresenceStore((state) => state.connectionStatus);
  const overlay = useOverlayStore((state) => state.primary);
  const previousPath = useRef<string | null>(null);
  const [validatedToken, setValidatedToken] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const [validationAttempt, setValidationAttempt] = useState(0);
  useEffect(() => {
    if (previousPath.current !== null && previousPath.current !== pathname)
      useOverlayStore.getState().closeAll();
    previousPath.current = pathname;
  }, [pathname]);
  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      router.replace('/welcome');
      return;
    }
    setLoadError('');
    void authApi
      .me()
      .then((freshUser) => {
        setUser(freshUser);
        setValidatedToken(token);
      })
      .catch((error: unknown) => {
        setValidatedToken(null);
        if (useAuthStore.getState().token === token) {
          setLoadError(error instanceof Error ? error.message : 'Signal could not connect.');
        }
      });
  }, [hydrated, token, setUser, router, validationAttempt]);
  if (loadError && token)
    return (
      <main className="loading-screen">
        <p role="alert">{loadError}</p>
        <button
          className="primary-button"
          onClick={() => setValidationAttempt((attempt) => attempt + 1)}
        >
          Retry
        </button>
      </main>
    );
  if (!hydrated || (token && (!user || validatedToken !== token)))
    return (
      <main className="loading-screen">
        <Spinner />
      </main>
    );
  if (!token || !user) return null;
  return (
    <WebSocketProvider>
      <div className="app-shell">
        <Sidebar />
        <main className="app-main">
          {connectionStatus === 'reconnecting' && (
            <div className="reconnecting-banner" role="status">
              Reconnecting…
            </div>
          )}
          {children}
        </main>
      </div>
      <NewChatModal />
      {activeConversationId && overlay?.kind === 'conversation-info' && (
        <GroupInfoPanel conversationId={activeConversationId} />
      )}
      {overlay?.kind === 'contact-profile' && (
        <ContactProfilePanel
          user={overlay.user}
          onClose={() => useOverlayStore.getState().closeTop()}
          overlayId={overlay.id}
        />
      )}
      {overlay?.kind === 'lightbox' && <AttachmentLightbox {...overlay} />}
    </WebSocketProvider>
  );
}
