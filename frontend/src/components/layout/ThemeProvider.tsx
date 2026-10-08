'use client';
import { useEffect } from 'react';
import { useUiStore } from '@/store/uiStore';
import { ToastViewport } from '@/components/ui/Toast';
import { ReactNode } from 'react';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useUiStore((state) => state.theme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      const query = window.matchMedia('(prefers-color-scheme: dark)');
      const apply = () => {
        root.dataset.theme = query.matches ? 'dark' : 'light';
      };
      apply();
      query.addEventListener('change', apply);
      return () => query.removeEventListener('change', apply);
    }
    root.dataset.theme = theme;
  }, [theme]);
  return (
    <>
      {children}
      <ToastViewport />
    </>
  );
}
