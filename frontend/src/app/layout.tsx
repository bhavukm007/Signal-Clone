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

export const metadata = {
  title: 'Signal',
  description: 'Private messaging for everyone.',
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
