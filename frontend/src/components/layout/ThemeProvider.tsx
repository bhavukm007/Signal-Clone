'use client';
import { useEffect } from 'react';
import { useUiStore } from '@/store/uiStore';
import { ToastViewport } from '@/components/ui/Toast';
import { OverlayInteractionManager } from '@/components/ui/OverlayManager';
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
    let resizeObserver: ResizeObserver;
    const updateViewport = () => {
      const panel = document.querySelector<HTMLElement>('.side-panel');
      if (panel && window.innerWidth >= 768) {
        const header = panel.querySelector<HTMLElement>('.side-panel-header');
        const headerBottom = header?.getBoundingClientRect().bottom ?? 60;
        root.style.setProperty('--toast-panel-top', `${headerBottom + 12}px`);
      } else {
        root.style.removeProperty('--toast-panel-top');
      }
    };
    resizeObserver = new ResizeObserver(updateViewport);
    updateViewport();
    window.addEventListener('resize', updateViewport);
    resizeObserver.observe(document.body);
    const refreshMeasurements = () => {
      updateViewport();
    };
    const mutationObserver = new MutationObserver(refreshMeasurements);
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.removeEventListener('resize', updateViewport);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, []);
  return (
    <>
      {children}
      <ToastViewport />
      <OverlayInteractionManager />
    </>
  );
}
