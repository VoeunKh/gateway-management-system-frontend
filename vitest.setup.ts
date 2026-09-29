import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/preact';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { setAccessToken } from './src/api/token';
import { resetDb } from './tests/msw/db';
import { server } from './tests/msw/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetDb();
  setAccessToken(null);
});
afterAll(() => server.close());
