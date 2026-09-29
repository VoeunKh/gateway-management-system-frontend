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
      // The backend's `make dev-up`; the dev container points this at the Docker host.
      '/api': process.env.API_PROXY_TARGET ?? 'http://localhost:8080',
    },
  },
  build: {
    target: ['chrome120', 'edge120', 'firefox120', 'safari17'],
    // Read by .size-limit.js to tell initial chunks from lazy ones.
    manifest: true,
    rollupOptions: {
      // TanStack Query marks files "use client" for React Server Components; meaningless here.
      onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && warning.message.includes('use client')) {
          return;
        }
        warn(warning);
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'tests/msw/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/api/types.gen.ts',
        'src/main.tsx',
        'src/ui/gallery/**',
        'src/ui/index.ts',
      ],
    },
  },
});
