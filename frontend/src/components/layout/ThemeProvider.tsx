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
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    const updateViewport = () => {
      const height = viewport?.height ?? window.innerHeight;
      root.style.setProperty('--visual-viewport-height', `${height}px`);
      const keyboard = Math.max(0, window.innerHeight - height - (viewport?.offsetTop ?? 0));
      root.style.setProperty('--keyboard-inset', `${keyboard}px`);
      const composer = document.querySelector<HTMLElement>('.composer-wrap');
      root.style.setProperty('--toast-bottom', `${(composer?.offsetHeight ?? 0) + keyboard}px`);
    };
    updateViewport();
    viewport?.addEventListener('resize', updateViewport);
    viewport?.addEventListener('scroll', updateViewport);
    window.addEventListener('resize', updateViewport);
    const observer = new ResizeObserver(updateViewport);
    observer.observe(document.body);
    const resizeComposer = () => {
      const composer = document.querySelector<HTMLElement>('.composer-wrap');
      if (composer) observer.observe(composer);
      updateViewport();
    };
    const mutationObserver = new MutationObserver(resizeComposer);
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    return () => {
      viewport?.removeEventListener('resize', updateViewport);
      viewport?.removeEventListener('scroll', updateViewport);
      window.removeEventListener('resize', updateViewport);
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, []);
  return (
    <>
      {children}
      <ToastViewport />
    </>
  );
}
