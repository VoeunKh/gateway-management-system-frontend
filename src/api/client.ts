import { ApiError, NETWORK_ERROR_MESSAGE, toApiError } from './errors';
import { SESSION_EXPIRED, authEvents, getAccessToken, setAccessToken } from './token';
import type { components } from './types.gen';

export const API_BASE = '/api/v1';

type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** Sent as JSON. */
  json?: unknown;
  /** Sent as text/plain (firmware manifests). */
  text?: string;
  query?: Query;
}

// These answer 401 for bad credentials, not an expired token, so they never refresh.
const NO_REFRESH = ['/auth/login', '/auth/refresh', '/auth/logout'];

let refreshing: Promise<boolean> | null = null;

function buildUrl(path: string, query?: Query): string {
  const url = new URL(API_BASE + path, window.location.origin);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function send(path: string, options: RequestOptions, token: string | null) {
  const { json, text, query, headers, ...init } = options;
  const merged = new Headers(headers);
  merged.set('Accept', 'application/json');
  if (json !== undefined) merged.set('Content-Type', 'application/json');
  if (text !== undefined) merged.set('Content-Type', 'text/plain');
  if (token) merged.set('Authorization', `Bearer ${token}`);

  try {
    return await fetch(buildUrl(path, query), {
      ...init,
      headers: merged,
      credentials: 'include',
      body: json !== undefined ? JSON.stringify(json) : text,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'network_error', NETWORK_ERROR_MESSAGE);
  }
}

/**
 * One refresh at a time: concurrent 401s share the same promise. Resolves false (and
 * announces session-expired) when the refresh cookie is missing or rejected.
 */
function refreshAccessToken(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const response = await send('/auth/refresh', { method: 'POST' }, null);
      if (!response.ok) throw await toApiError(response);
      const body = (await response.json()) as components['schemas']['LoginResponse'];
      setAccessToken(body.access_token);
      return true;
    } catch {
      setAccessToken(null);
      authEvents.dispatchEvent(new Event(SESSION_EXPIRED));
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/**
 * The only way the console talks to the backend. `T` must come from types.gen.ts.
 * On a 401 the access token is refreshed once and the request replayed once.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getAccessToken();
  const response = await send(path, options, token);
  if (response.status !== 401 || NO_REFRESH.includes(path)) return parse<T>(response);

  // Another request may already have refreshed while this one was in flight.
  const current = getAccessToken();
  const fresh = current !== null && current !== token ? true : await refreshAccessToken();
  if (!fresh) return parse<T>(response);
  return parse<T>(await send(path, options, getAccessToken()));
}
