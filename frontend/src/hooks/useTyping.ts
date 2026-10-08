import { useCallback, useEffect, useRef } from 'react';
import type { SendEvent } from '@/hooks/useWebSocket';

export function useTyping(send: SendEvent, conversationId: string) {
  const started = useRef(false);
  const startTimer = useRef<number | null>(null);
  const stopTimer = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (startTimer.current !== null) window.clearTimeout(startTimer.current);
    startTimer.current = null;
    if (stopTimer.current !== null) window.clearTimeout(stopTimer.current);
    stopTimer.current = null;
    if (started.current) send('typing.stop', { conversation_id: conversationId });
    started.current = false;
  }, [conversationId, send]);

  const activity = useCallback((value: string) => {
    if (!value.trim()) {
      stop();
      return;
    }
    if (stopTimer.current !== null) window.clearTimeout(stopTimer.current);
    if (!started.current && startTimer.current === null) {
      startTimer.current = window.setTimeout(() => {
        startTimer.current = null;
        started.current = send('typing.start', { conversation_id: conversationId });
      }, 300);
    }
    stopTimer.current = window.setTimeout(stop, 1700);
  }, [conversationId, send, stop]);

  useEffect(() => () => stop(), [stop]);
  return activity;
}
