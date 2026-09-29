import { HttpResponse, http } from 'msw';
import type { components } from '@/api/types.gen';
import { currentUser, denyUnless, errorJson, issueToken } from '../auth';
import { db } from '../db';
import { api } from './api';

type S = components['schemas'];

export const authHandlers = [
  http.post<never, S['LoginRequest']>(api('/auth/login'), async ({ request }) => {
    const body = await request.json();
    if (!body?.email || !body.password) {
      return errorJson(400, 'bad_request', 'email and password are required');
    }
    const entry = db.users.find((candidate) => candidate.user.email === body.email);
    if (entry?.locked) return errorJson(401, 'account_locked', 'account is temporarily locked');
    if (!entry || entry.password !== body.password) {
      return errorJson(401, 'invalid_credentials', 'invalid email or password');
    }
    const response: S['LoginResponse'] = {
      access_token: issueToken(entry.user.id),
      user: entry.user,
    };
    return HttpResponse.json(response);
  }),

  http.post(api('/auth/refresh'), () => {
    const entry = db.users.find((candidate) => candidate.user.id === db.refreshUserId);
    if (!entry) return errorJson(401, 'unauthorized', 'refresh token missing or revoked');
    const response: S['LoginResponse'] = {
      access_token: issueToken(entry.user.id),
      user: entry.user,
    };
    return HttpResponse.json(response);
  }),

  http.post(api('/auth/logout'), () => {
    db.refreshUserId = null;
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(api('/auth/me'), ({ request }) => {
    const denied = denyUnless(request);
    if (denied) return denied;
    const user: S['User'] | null = currentUser(request);
    return HttpResponse.json(user);
  }),
];
