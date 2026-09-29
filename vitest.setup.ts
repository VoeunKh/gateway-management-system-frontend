import '@testing-library/jest-dom/vitest';
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';
import { cleanup } from '@testing-library/preact';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { setAccessToken } from './src/api/token';
import { resetDb } from './tests/msw/db';
import { server } from './tests/msw/server';

// jsdom's Blob and File are not understood by Node's fetch (a FormData holding one hangs
// under MSW). Node's own behave like a browser's here, so uploads can be tested.
globalThis.Blob = NodeBlob as unknown as typeof Blob;
globalThis.File = NodeFile as unknown as typeof File;
// FormData too: jsdom's turns a Node File into the text "[object File]". Node's constructor is
// reachable through a parsed body.
const parsed = await new Response('a=1', {
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
}).formData();
globalThis.FormData = parsed.constructor as typeof FormData;

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
