import { ReactNode } from 'react';
import { AppProviders } from './providers';
import './globals.css';

export const metadata = {
  title: 'Signal',
  description: 'Private messaging for everyone.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body><AppProviders>{children}</AppProviders></body></html>;
}
