import type { RequestHandler } from 'msw';

// One handler per endpoint, typed with src/api/types.gen.ts, arrives in UI-03.
export const handlers: RequestHandler[] = [];
