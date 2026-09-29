import { HttpResponse, http } from 'msw';
import { api } from '../../tests/msw/handlers/api';
import { server } from '../../tests/msw/server';
import { API_BASE, request } from './client';
import { ApiError, NETWORK_ERROR_MESSAGE } from './errors';
import { SESSION_EXPIRED, authEvents, getAccessToken, setAccessToken } from './token';

const authOf = (req: Request) => req.headers.get('Authorization');

/** /things answers 401 unless called with `good`; refresh hands out `good`. */
function expiringToken({ refreshOk = true } = {}) {
  const calls = { refresh: 0, things: 0 };
  server.use(
    http.get(api('/things'), ({ request: req }) => {
      calls.things++;
      return authOf(req) === 'Bearer good'
        ? HttpResponse.json({ ok: true })
        : HttpResponse.json(
            { error: { code: 'unauthorized', message: 'expired' } },
            { status: 401 },
          );
    }),
    http.post(api('/auth/refresh'), async () => {
      calls.refresh++;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return refreshOk
        ? HttpResponse.json({
            access_token: 'good',
            user: { id: 'u', email: 'a@b.c', name: 'A', role: 'admin' },
          })
        : HttpResponse.json({ error: { code: 'unauthorized', message: 'no' } }, { status: 401 });
    }),
  );
  return calls;
}

describe('request', () => {
  it('attaches the bearer token, JSON headers and query string', async () => {
    let seen: Request | undefined;
    server.use(
      http.get(api('/things'), ({ request: req }) => {
        seen = req;
        return HttpResponse.json({ ok: true });
      }),
    );
    setAccessToken('abc');
    await request('/things', { query: { model: 'GW200', drift: true, q: '', cursor: undefined } });
    expect(authOf(seen as Request)).toBe('Bearer abc');
    expect(seen?.headers.get('Accept')).toBe('application/json');
    expect(new URL(seen?.url ?? '').pathname).toBe(`${API_BASE}/things`);
    expect(new URL(seen?.url ?? '').search).toBe('?model=GW200&drift=true');
  });

  it('sends no Authorization header when logged out', async () => {
    let header: string | null = 'unset';
    server.use(
      http.post(api('/auth/login'), ({ request: req }) => {
        header = authOf(req);
        return HttpResponse.json({});
      }),
    );
    await request('/auth/login', { method: 'POST', json: { email: 'a', password: 'b' } });
    expect(header).toBeNull();
  });

  it('refreshes once on a 401 and replays the request', async () => {
    const calls = expiringToken();
    setAccessToken('stale');
    await expect(request('/things')).resolves.toEqual({ ok: true });
    expect(calls).toEqual({ refresh: 1, things: 2 });
    expect(getAccessToken()).toBe('good');
  });

  it('shares one refresh between parallel 401s and retries all of them', async () => {
    const calls = expiringToken();
    setAccessToken('stale');
    const results = await Promise.all([request('/things'), request('/things'), request('/things')]);
    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(calls).toEqual({ refresh: 1, things: 6 });
  });

  it('clears the session and announces it when refresh fails, without looping', async () => {
    const calls = expiringToken({ refreshOk: false });
    const expired = vi.fn();
    authEvents.addEventListener(SESSION_EXPIRED, expired);
    setAccessToken('stale');
    await expect(request('/things')).rejects.toMatchObject({ status: 401, code: 'unauthorized' });
    authEvents.removeEventListener(SESSION_EXPIRED, expired);
    expect(calls).toEqual({ refresh: 1, things: 1 });
    expect(getAccessToken()).toBeNull();
    expect(expired).toHaveBeenCalledOnce();
  });

  it('does not refresh when the login itself answers 401', async () => {
    const calls = expiringToken();
    server.use(
      http.post(api('/auth/login'), () =>
        HttpResponse.json(
          { error: { code: 'invalid_credentials', message: 'invalid email or password' } },
          { status: 401 },
        ),
      ),
    );
    await expect(
      request('/auth/login', { method: 'POST', json: { email: 'a', password: 'b' } }),
    ).rejects.toMatchObject({ status: 401, code: 'invalid_credentials' });
    expect(calls.refresh).toBe(0);
  });

  it('parses the error body into an ApiError', async () => {
    server.use(
      http.post(api('/things'), () =>
        HttpResponse.json(
          {
            error: {
              code: 'config_invalid',
              message: 'line 4 is not valid UCI',
              details: { line: 4 },
            },
          },
          { status: 422 },
        ),
      ),
    );
    const error = await request('/things', { method: 'POST', text: 'x' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 422,
      code: 'config_invalid',
      message: 'line 4 is not valid UCI',
      details: { line: 4 },
    });
  });

  it('handles an error body that is not JSON', async () => {
    server.use(
      http.get(
        api('/things'),
        () => new HttpResponse('<h1>Bad gateway</h1>', { status: 502, statusText: 'Bad Gateway' }),
      ),
    );
    await expect(request('/things')).rejects.toMatchObject({
      status: 502,
      code: 'http_502',
      message: 'The server answered 502 Bad Gateway. Try again in a moment.',
    });
  });

  it('turns a network failure into a readable message', async () => {
    server.use(http.get(api('/things'), () => HttpResponse.error()));
    await expect(request('/things')).rejects.toMatchObject({
      status: 0,
      code: 'network_error',
      message: NETWORK_ERROR_MESSAGE,
    });
  });

  it('returns undefined for 204 and passes aborts through untouched', async () => {
    server.use(http.delete(api('/things'), () => new HttpResponse(null, { status: 204 })));
    await expect(request('/things', { method: 'DELETE' })).resolves.toBeUndefined();

    server.use(http.get(api('/slow'), () => new Promise<Response>(() => undefined)));
    const controller = new AbortController();
    const pending = request('/slow', { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});
