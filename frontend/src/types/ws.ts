export interface WsFrame {
  type: string;
  payload: Record<string, unknown>;
}
