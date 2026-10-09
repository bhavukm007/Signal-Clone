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
    let observedBar: HTMLElement | null = null;
    const appShell = () => document.querySelector<HTMLElement>('.app-shell');
    const viewport = window.visualViewport;
    const updateViewport = () => {
      const height = viewport?.height ?? window.innerHeight;
      root.style.setProperty('--visual-viewport-height', `${height}px`);
      const keyboard = Math.max(0, window.innerHeight - height - (viewport?.offsetTop ?? 0));
      root.style.setProperty('--keyboard-inset', `${keyboard}px`);
      const bar = document.querySelector<HTMLElement>('.composer-wrap, .blocked-composer');
      const barHeight = bar?.getBoundingClientRect().height ?? 24;
      root.style.setProperty('--composer-height', `${barHeight}px`);
      appShell()?.style.setProperty('--composer-height', `${barHeight}px`);
      if (bar !== observedBar) {
        if (observedBar) resizeObserver.unobserve(observedBar);
        observedBar = bar;
        if (bar) resizeObserver.observe(bar);
      }
      const main = document.querySelector<HTMLElement>('.app-main');
      const panel = document.querySelector<HTMLElement>('.side-panel');
      if (main && panel && window.innerWidth >= 768) {
        const mainRect = main.getBoundingClientRect();
        const visibleRight = Math.max(
          mainRect.left,
          Math.min(mainRect.right, panel.getBoundingClientRect().left),
        );
        const visibleWidth = visibleRight - mainRect.left;
        if (visibleWidth >= 180) {
          root.style.setProperty('--toast-center-x', `${mainRect.left + visibleWidth / 2}px`);
          root.style.setProperty('--toast-max-width', `${visibleWidth - 24}px`);
        } else {
          root.style.setProperty('--toast-center-x', `${window.innerWidth / 2}px`);
          root.style.setProperty('--toast-max-width', '90vw');
        }
      } else {
        root.style.setProperty('--toast-center-x', `${window.innerWidth / 2}px`);
        root.style.setProperty('--toast-max-width', '90vw');
      }
    };
    resizeObserver = new ResizeObserver(updateViewport);
    updateViewport();
    viewport?.addEventListener('resize', updateViewport);
    viewport?.addEventListener('scroll', updateViewport);
    window.addEventListener('resize', updateViewport);
    resizeObserver.observe(document.body);
    const refreshMeasurements = () => {
      const shell = appShell();
      if (shell) resizeObserver.observe(shell);
      updateViewport();
    };
    const mutationObserver = new MutationObserver(refreshMeasurements);
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    return () => {
      viewport?.removeEventListener('resize', updateViewport);
      viewport?.removeEventListener('scroll', updateViewport);
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
