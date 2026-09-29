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
    const before = getAccessToken();
    try {
      const response = await send('/auth/refresh', { method: 'POST' }, null);
      if (!response.ok) throw await toApiError(response);
      const body = (await response.json()) as components['schemas']['LoginResponse'];
      setAccessToken(body.access_token);
      return true;
    } catch {
      // Someone signed in while this refresh was failing: keep their new session.
      if (getAccessToken() !== before) return true;
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

export interface UploadOptions {
  /** 0..1 as the body goes out. */
  onProgress?: (fraction: number) => void;
}

/** fetch cannot report upload progress, so file uploads go through XMLHttpRequest. */
function sendForm(path: string, form: FormData, token: string | null, options: UploadOptions) {
  return new Promise<Response>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', buildUrl(path));
    xhr.withCredentials = true;
    xhr.setRequestHeader('Accept', 'application/json');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress?.(event.loaded / event.total);
    };
    xhr.onerror = () => reject(new ApiError(0, 'network_error', NETWORK_ERROR_MESSAGE));
    xhr.onload = () =>
      resolve(
        new Response(xhr.status === 204 ? null : xhr.responseText, {
          status: xhr.status,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    xhr.send(form);
  });
}

/** Multipart POST with the same sign-in handling as `request`: refresh once on a 401, replay once. */
export async function upload<T>(path: string, form: FormData, options: UploadOptions = {}) {
  const token = getAccessToken();
  const response = await sendForm(path, form, token, options);
  if (response.status !== 401) return parse<T>(response);
  const current = getAccessToken();
  const fresh = current !== null && current !== token ? true : await refreshAccessToken();
  if (!fresh) return parse<T>(response);
  return parse<T>(await sendForm(path, form, getAccessToken(), options));
}
