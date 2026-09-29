// The access token lives in memory only; the refresh token is an HttpOnly cookie the
// browser sends to /api/v1/auth. A reload therefore starts without an access token and
// the first 401 refreshes it.

let accessToken: string | null = null;

/** Fires `session-expired` when a refresh fails; the session context listens. */
export const authEvents = new EventTarget();
export const SESSION_EXPIRED = 'session-expired';

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}
