import { HttpResponse, http } from 'msw';
import type { components } from '@/api/types.gen';
import { denyUnless, errorJson } from '../auth';
import { db } from '../db';
import { api } from './api';

type S = components['schemas'];

const findUser = (id: string) => db.users.find((entry) => entry.user.id === id);

export const userHandlers = [
  http.get(api('/users'), ({ request }) => {
    const denied = denyUnless(request, 'admin');
    if (denied) return denied;
    const users: S['User'][] = db.users.map((entry) => entry.user);
    return HttpResponse.json(users);
  }),

  http.post<never, S['CreateUserRequest']>(api('/users'), async ({ request }) => {
    const denied = denyUnless(request, 'admin');
    if (denied) return denied;
    const body = await request.json();
    if (db.users.some((entry) => entry.user.email === body.email)) {
      return errorJson(409, 'conflict', 'a user with this email already exists');
    }
    const user: S['User'] = {
      id: crypto.randomUUID(),
      email: body.email,
      name: body.name,
      role: body.role,
    };
    db.users.push({ user, password: body.password });
    return HttpResponse.json(user, { status: 201 });
  }),

  http.get<{ id: string }>(api('/users/:id'), ({ request, params }) => {
    const denied = denyUnless(request, 'admin');
    if (denied) return denied;
    const entry = findUser(params.id);
    return entry ? HttpResponse.json(entry.user) : errorJson(404, 'not_found', 'no such user');
  }),

  http.patch<{ id: string }, S['UpdateUserRequest']>(
    api('/users/:id'),
    async ({ request, params }) => {
      const denied = denyUnless(request, 'admin');
      if (denied) return denied;
      const entry = findUser(params.id);
      if (!entry) return errorJson(404, 'not_found', 'no such user');
      entry.user.role = (await request.json()).role;
      return HttpResponse.json(entry.user);
    },
  ),

  http.delete<{ id: string }>(api('/users/:id'), ({ request, params }) => {
    const denied = denyUnless(request, 'admin');
    if (denied) return denied;
    if (!findUser(params.id)) return errorJson(404, 'not_found', 'no such user');
    db.users = db.users.filter((entry) => entry.user.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),
];
