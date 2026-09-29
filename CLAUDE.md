# gwfleet web console

Console for managing ~300 OpenWrt LTE gateways: overview, devices, remote actions,
UCI config push, sysupgrade rollouts, alerts, users. Roles: Admin, Release engineer,
Viewer. Built from the approved sample console.

## Stack (fixed)
Preact 10 + TypeScript (React API via preact/compat), Vite 5, wouter (routing, via its
Preact build wouter-preact),
TanStack Query v5 (server data), zod (parsing), plain CSS custom properties,
inline SVG for charts and icons, Vitest + Testing Library + MSW, Playwright.

## Layout
src/{app,api,auth,features,ui,lib,styles}, tests/{msw,e2e}. Features: overview, devices,
config, firmware, alerts, users.

## Commands
npm run dev | npm run build | npm test | npm run lint | npm run typecheck
npm run size      # size-limit, blocking
npm run gen:api   # openapi-typescript from api/openapi.yaml (vendored spec) into src/api/types.gen.ts
npm run e2e       # Playwright
make dev | make check | make prod-up   # Docker: dev server, all checks, production image (make lists all)

## Rules
- No new dependencies. No component library, Tailwind, Redux, Axios, date library,
  chart or icon package. Charts and icons are hand-written inline SVG.
- Budget: initial JS <= 120 KB gzipped, CSS <= 15 KB, largest lazy chunk <= 40 KB.
  npm run size must pass.
- All API types come from src/api/types.gen.ts (generated). Never hand-write a response
  type. Never use `any`. tsconfig strict + noUncheckedIndexedAccess stay on.
- Fetching only in hooks (useDevices, useRollout). Pages compose hooks and components
  and contain no fetch calls. All requests go through src/api/client.ts.
- A feature folder imports from ui, lib, api, auth only — never another feature.
- Every screen handles three states: loading (skeleton), empty, error (message + Retry).
- Role checks: <RequireRole min> for routes, <Can perm> for controls (disabled with the
  tooltip "Your role (X) can't do this", never hidden). The server enforces the rule.
- Colour never carries meaning alone; always a label too.
- Dates and numbers via Intl helpers in lib/format.ts.
- Polling intervals live in one file (src/api/polling.ts); tabs in the background do not
  poll.
- Tests with Testing Library query by role and label; MSW handlers in tests/msw.
- Named exports only; files under ~200 lines.

## Done means
Code + unit tests in the same change; npm run lint, typecheck, test and size all pass;
evaluation steps of the task card pass; checked at 375 px and 1280 px, light and dark,
keyboard only.
