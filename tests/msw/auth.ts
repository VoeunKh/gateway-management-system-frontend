import { HttpResponse } from 'msw';
import type { components } from '@/api/types.gen';
import { setAccessToken } from '@/api/token';
import { db } from './db';

type Role = components['schemas']['User']['role'];
const RANK: Record<Role, number> = { viewer: 0, release: 1, admin: 2 };

export const errorJson = (status: number, code: string, message: string, details?: unknown) =>
  HttpResponse.json({ error: { code, message, details: details ?? null } }, { status });

export function issueToken(userId: string): string {
  const token = `mock-token-${userId.slice(-4)}-${++db.tokenSerial}`;
  db.tokens.set(token, userId);
  db.refreshUserId = userId;
  return token;
}

export function currentUser(request: Request) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer /, '');
  const userId = token ? db.tokens.get(token) : undefined;
  return db.users.find((entry) => entry.user.id === userId)?.user ?? null;
}

/** Returns an error response when the caller is signed out or below `min`, else null. */
export function denyUnless(request: Request, min: Role = 'viewer') {
  const user = currentUser(request);
  if (!user) return errorJson(401, 'unauthorized', 'missing or expired access token');
  if (RANK[user.role] < RANK[min]) return errorJson(403, 'forbidden', 'your role cannot do this');
  return null;
}

/** Test helper: sign the client in as the seeded user with this role. */
export function signInAs(role: Role): string {
  const entry = db.users.find((candidate) => candidate.user.role === role && !candidate.locked);
  if (!entry) throw new Error(`No fixture user with role ${role}`);
  const token = issueToken(entry.user.id);
  setAccessToken(token);
  return token;
}
