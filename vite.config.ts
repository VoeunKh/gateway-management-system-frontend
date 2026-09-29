/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const src = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  resolve: {
    // Libraries written against React (TanStack Query, Testing Library) run on Preact.
    alias: [
      { find: '@', replacement: src },
      { find: /^react-dom\/test-utils$/, replacement: 'preact/test-utils' },
      { find: /^react\/jsx-runtime$/, replacement: 'preact/jsx-runtime' },
      { find: /^react-dom$/, replacement: 'preact/compat' },
      { find: /^react$/, replacement: 'preact/compat' },
    ],
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
  build: {
    target: ['chrome120', 'edge120', 'firefox120', 'safari17'],
    // Read by .size-limit.js to tell initial chunks from lazy ones.
    manifest: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'tests/unit/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/api/types.gen.ts', 'src/main.tsx'],
    },
  },
});
