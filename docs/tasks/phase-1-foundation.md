# Phase 1: Foundation (Sep 29 – Oct 2)

Phase 1 ends when a person can log in against the dev stack, the shell renders with their
role, and the production build is under budget.

Order: UI-01 → UI-02 → UI-03 → UI-04 (UI-02 and UI-03 can run in either order after UI-01).

---

## UI-01 Project setup, CI stage and size gate

**Depends on:** –

**Goal:** a `web/` app that builds, lints, type-checks, tests and fails CI when the
bundle grows past budget.

**What to do**

1. Create `web/` in the backend repo: Vite 5 + Preact 10 + TypeScript, with
   `preact/compat` aliased to `react` and `react-dom` in `vite.config.ts`.
2. `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`,
   `verbatimModuleSyntax`, path alias `@/*` → `src/*`.
3. Dev proxy: `/api` → `http://localhost:8080` (the `make dev-up` backend).
4. ESLint (typescript-eslint, react-hooks) + Prettier; scripts `dev`, `build`,
   `preview`, `lint`, `typecheck`, `test`, `size`, `gen:api`, `e2e`.
5. Vitest with jsdom + Testing Library + MSW; `tests/msw/server.ts` wired into
   `vitest.setup.ts`.
6. `size-limit` config with the three budgets from the README; `npm run size` fails above.
7. Route-level code splitting set up in the router file (added in UI-04) so every screen
   after login/overview is a lazy chunk.
8. GitLab CI `web` stage: lint, typecheck, test, build, size — runs only when `web/**`
   or `api/openapi.yaml` changed.
9. Short `web/README.md`: commands, browser targets (last 2 versions of Chrome, Edge,
   Firefox, Safari), and the no-new-dependencies rule.

**Unit tests**

- One smoke test rendering an `<App/>` placeholder, proving jsdom + Testing Library +
  MSW all work.

**Results:** `web/` project, CI stage, size gate, README.

**Evaluation**

- `npm run build` succeeds; `npm run size` passes with the empty app well under budget
  (report the numbers in the merge request).
- `npm run lint`, `npm run typecheck`, `npm test` all pass.
- Adding `import 'react-dom'` without the alias fails the build (proves the alias works);
  revert after checking.
- CI `web` stage green, and skipped on a commit that touches only backend Go files.

**Notes:** do not add any dependency beyond the fixed stack. Vite's default `modulepreload`
polyfill can stay; nothing else.

---

## UI-02 Design tokens and ui components

**Depends on:** UI-01

**Goal:** the sample's look as a small set of reusable components, with all three screen
states available before any screen is built.

**What to do**

1. Port the sample's CSS into `src/styles/app.css`: color, spacing, radius, shadow and
   font tokens on `:root`; dark mode under `@media (prefers-color-scheme: dark)` guarded
   by `:root:not([data-theme="light"])` and again under `:root[data-theme="dark"]`.
2. Build `src/ui/`: `Button`, `Table`, `Badge`, `Field`, `Dialog` (native `<dialog>`),
   `Toast` + `ToastProvider`, `Skeleton`, `EmptyState`, `ErrorState`, `Tooltip` (CSS
   `title` is enough for the role message).
3. `src/ui/icons.tsx`: 12 inline SVG icons (gateway, search, refresh, upload, play,
   pause, stop, check, warning, clock, user, chevron), each a small function component
   taking `size` and `title`.
4. `src/ui/Sparkline.tsx`: the sample's SVG line chart, props `values`, `label`;
   `preserveAspectRatio="none"`, `vector-effect="non-scaling-stroke"`.
5. A dev-only route `/ui` (excluded from the production build) rendering every component
   in every state, light and dark, for visual checks.

**Unit tests**

- `Button`: disabled renders the `title` tooltip text; variant class applied.
- `Dialog`: opens, traps focus, closes on Escape, returns focus to the trigger.
- `Toast`: queue caps at 3; container has `aria-live="polite"`; auto-dismisses with fake
  timers.
- `Field`: label `htmlFor` matches input `id`; error text tied by `aria-describedby`.
- `Badge`: renders text alongside colour for every health state.
- `Sparkline`: renders a polyline with the right number of points; empty array renders
  nothing and no crash.

**Results:** token stylesheet, ~10 ui components, icon set, `/ui` gallery.

**Evaluation**

- `npm test` passes; `ui` coverage ≥ 80%.
- `/ui` gallery: every component readable in light and dark, keyboard-reachable, focus
  ring visible.
- Toggling the OS theme changes the gallery with no reload.
- CSS gzipped size reported and under 15 KB.

**Notes:** no component may hard-code a colour; only tokens. Colour never carries meaning
without a text label.

---

## UI-03 API client, generated types, MSW fixtures

**Depends on:** UI-01, `api/openapi.yaml` from BE-01.4

**Goal:** one typed way to call the backend, with refresh and errors handled once.

**What to do**

1. `npm run gen:api` → `openapi-typescript ../api/openapi.yaml -o src/api/types.gen.ts`;
   CI fails if the committed file differs.
2. `src/api/client.ts`: `request<T>(path, init)` adding base URL, `Authorization` bearer,
   `credentials: "include"`, JSON headers; parses `{error:{code,message,details}}` into
   an `ApiError` class with `status`; network failure gives a readable message.
3. Refresh: on 401 (except on `/auth/*`), call `POST /auth/refresh` once; queue other
   requests while refreshing; replay them after; on refresh failure clear the session and
   emit a `session-expired` event.
4. `src/api/endpoints.ts`: one typed function per endpoint used in v1, returning
   generated types.
5. `src/api/polling.ts`: the intervals table (rollout 5 s, job 3 s, overview/alerts 30 s,
   devices 30 s, metrics 60 s) in one place.
6. Query client with `refetchIntervalInBackground: false`, `gcTime` 5 min, retry 1 for
   GET, 0 for writes.
7. `tests/msw/`: handlers and fixtures for every endpoint, typed with the generated types
   (300 devices, 5 models, rollouts in each state, alerts, config versions).

**Unit tests**

- Token attached; absent when logged out.
- 401 → one refresh → original request retried and resolved.
- Three parallel 401s → exactly one refresh call, all three retried.
- Refresh failure → session cleared, `session-expired` emitted, no infinite loop.
- Error body parsed into `ApiError` with code and details; non-JSON error body handled.
- Network error message is human-readable.
- 401 from `/auth/login` does not trigger refresh.

**Results:** client, generated types, endpoints, polling table, MSW fixtures.

**Evaluation**

- `npm test` passes; `api` coverage ≥ 90%.
- `npm run gen:api` produces no diff after a clean run.
- Changing a field name in a local copy of the spec breaks `npm run typecheck` (proves
  the contract is enforced); revert after checking.

**Notes:** never hand-write a response type. Fixtures are the only place sample data
lives; screens must not embed their own.

---

## UI-04 App shell, router, session, login, role guards

**Depends on:** UI-02, UI-03

**Goal:** the frame every screen renders inside, with roles reflected in the UI.

**What to do**

1. `src/auth/session.tsx`: context holding user, role and token; `useSession()`;
   bootstraps from `GET /auth/me` on load; clears on `session-expired`.
2. `src/auth/LoginPage.tsx`: email + password, inline errors, disabled submit while
   pending, message for `account_locked`, autofocus, submit on Enter.
3. `src/auth/guards.tsx`: `<RequireRole min="admin">` (redirect to `/` with a toast) and
   `<Can perm="rollout">` (renders children disabled with
   `title="Your role (Viewer) can't do this"`).
4. `src/app/Shell.tsx`: the sample's rail with nav items, open-alert count badge, role
   display, logout; responsive to a top bar under 820 px.
5. `src/app/router.tsx`: wouter routes for the 8 paths; every screen except login and
   overview `lazy()`-loaded with a `Skeleton` fallback.
6. 404 route with an EmptyState and a link home.

**Unit tests**

- Login: success stores session and redirects; wrong password shows the API message;
  locked account shows its message; submit disabled while pending.
- Session: bootstraps from `/auth/me`; `session-expired` clears and routes to login.
- `RequireRole`: viewer hitting `/users` is redirected; admin renders it.
- `Can`: control enabled for release, disabled with tooltip for viewer.
- Shell: nav marks the active route; alert badge shows the count; logout clears session.

**Results:** session context, login page, guards, shell, router.

**Evaluation**

- `npm test` passes; `auth` coverage ≥ 90%.
- Against `make dev-up`: log in as admin, release and viewer (seeded users) — the rail
  and controls differ as expected.
- Keyboard only: tab from the email field to submit and log in; focus visible throughout.
- `npm run size`: initial JS still under 120 KB gzipped (report the number).

**Notes:** the login page must work with a password manager (correct `autocomplete`
attributes, real `<form>` with submit).
