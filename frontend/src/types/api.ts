export interface ApiErrorPayload {
  error: { code: string; message: string };
}

export interface PageCursor {
  before?: string;
  limit?: number;
}

export interface OtpChallengeResponse {
  ok: boolean;
  hint: string;
}
