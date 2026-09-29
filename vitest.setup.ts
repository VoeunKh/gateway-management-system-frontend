import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/preact';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './tests/msw/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
