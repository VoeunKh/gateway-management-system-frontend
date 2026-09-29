import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/preact';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { setAccessToken } from './src/api/token';
import { resetDb } from './tests/msw/db';
import { server } from './tests/msw/server';

// jsdom has no pointer-event handler properties, and Preact binds onPointerMove as
// "pointermove" only when the element has one (browsers do), so give it the same.
for (const name of ['onpointermove', 'onpointerleave', 'onpointerdown', 'onpointerup']) {
  if (!(name in HTMLElement.prototype)) {
    Object.defineProperty(HTMLElement.prototype, name, {
      value: null,
      writable: true,
      configurable: true,
    });
  }
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetDb();
  setAccessToken(null);
  sessionStorage.clear();
});
afterAll(() => server.close());
