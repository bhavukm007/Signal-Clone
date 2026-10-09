import { ReactNode } from 'react';
import { AppProviders } from './providers';
import './globals.css';
import '../styles/shell.css';
import '../styles/chat.css';
import '../styles/controls.css';
import '../styles/settings.css';
import '../styles/responsive.css';
import '../styles/conversation-details.css';
import '../styles/attachments.css';
import '../styles/utilities.css';
import '../styles/contacts.css';
import '../styles/panels.css';
import '../styles/onboarding.css';

export const metadata = {
  title: 'Signal',
  description: 'Private messaging for everyone.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Signal' },
  icons: {
    icon: [
      { url: '/icons/chat-192.svg', sizes: '192x192', type: 'image/svg+xml' },
      { url: '/icons/chat-512.svg', sizes: '512x512', type: 'image/svg+xml' },
    ],
    apple: '/icons/chat-192.svg',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1b1b1b' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
