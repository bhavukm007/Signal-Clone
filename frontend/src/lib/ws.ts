import { WS_URL } from '@/lib/constants';
import type { WsFrame } from '@/types/ws';

export type WsEventHandler = (event: WsFrame) => void;

export class WsClient {
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private attempt = 0;
  private stopped = true;
  private connectedOnce = false;

  constructor(
    private readonly token: string,
    private readonly onEvent: WsEventHandler,
    private readonly onReconnect: () => void,
  ) {}

  connect(): void {
    this.stopped = false;
    this.open();
  }

  send(type: string, payload: Record<string, unknown>): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify({ type, payload }));
    return true;
  }

  dispose(): void {
    this.stopped = true;
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
    if (this.heartbeatTimer !== null) window.clearInterval(this.heartbeatTimer);
    this.socket?.close();
    this.socket = null;
  }

  private open(): void {
    if (this.stopped) return;
    const separator = WS_URL.includes('?') ? '&' : '?';
    const socket = new WebSocket(`${WS_URL}${separator}token=${encodeURIComponent(this.token)}`);
    this.socket = socket;
    socket.onopen = () => {
      this.attempt = 0;
      if (this.connectedOnce) this.onReconnect();
      this.connectedOnce = true;
      this.heartbeatTimer = window.setInterval(() => this.send('ping', {}), 25000);
    };
    socket.onmessage = (message) => {
      try {
        const frame = JSON.parse(String(message.data)) as WsFrame;
        this.onEvent(frame);
      } catch {
        // Invalid frames are ignored; the next REST sync will reconcile state.
      }
    };
    socket.onclose = () => {
      if (this.heartbeatTimer !== null) window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      this.scheduleReconnect();
    };
    socket.onerror = () => socket.close();
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer !== null) return;
    const delay = Math.min(1000 * 2 ** this.attempt, 30000);
    this.attempt += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }
}
