# gwfleet web console — build tasks for Claude Code

Frontend for the Gateway Fleet Management System v1 MVP: ~300 OpenWrt LTE gateways
(5 models), on-prem backend, existing EMQX. Built from the approved sample console.
Go-live 2026-10-20.

This repository holds the console on its own. The backend's OpenAPI spec is vendored at
`api/openapi.yaml`; update that copy in the same pull request as the screen that needs it.

## Development

Node 22 (see `.nvmrc`). Browser targets: last 2 versions of Chrome, Edge, Firefox, Safari.

```sh
npm ci
npm run dev        # http://localhost:5173, /api proxied to the backend on :8080
npm run lint       # ESLint + Prettier check
npm run typecheck
npm test           # Vitest + Testing Library + MSW (npm run coverage for coverage)
npm run build
npm run size       # blocking: fails above the budgets below (run after build)
npm run gen:api    # api/openapi.yaml -> src/api/types.gen.ts
npm run e2e        # Playwright against the production build
```

### With Docker (make)

Only Docker (with Compose v2) and `make` are needed; Node runs in the containers.
`make` alone lists every target. Settings come from `.env` (copy `.env.example`).

| Command | What it does |
| --- | --- |
| `make dev` | Vite with hot reload at http://localhost:5173; `/api` goes to the backend on the Docker host (`API_PROXY_TARGET`) |
| `make dev-up` / `dev-down` / `dev-logs` | Same in the background, stop, follow logs |
| `make dev-shell` | Shell in the dev container (`npm test`, `npx vitest`, …) |
| `make dev-install` | Reinstall `node_modules` in the container after `package-lock.json` changes |
| `make check` | Lint, typecheck, tests, build and size budget in a clean container |
| `make prod-build` | Production image `gwfleet-web:<git commit>` (and `:latest`); fails if any check fails |
| `make prod-up` / `prod-down` | Build and run it at http://localhost:8081, stop it |
| `make prod-restart` / `prod-logs` / `prod-ps` | Apply `.env` changes, follow logs, show health |
| `make smoke` | Check the running production container answers `/healthz` and serves the app |

Production is a non-root nginx image (about 80 MB) with a read-only filesystem:

- serves the bundle with `index.html` revalidated on every load and hashed `/assets/` cached for
  a year, gzip, and security headers including a strict Content-Security-Policy;
- proxies `/api/` to `API_UPSTREAM` (`scheme://host:port`, default the Docker host on 8080), so
  the refresh cookie stays same-origin, passing on an outer proxy's `X-Forwarded-Proto`; the
  name is resolved when the container starts, so run `make prod-restart` if the backend's
  address changes;
- `/healthz` for load balancers and the container health check.

The full guide, covering how the image is built, every setting, deploying to a server, HTTPS,
and troubleshooting, is [docs/docker.md](docs/docker.md).

Behind a TLS-intercepting proxy, pass its CA to the npm install with
`make prod-build BUILD_CA=/path/ca.crt` (a build secret, not stored in the image) and any extra
`docker build` flags with `DOCKER_BUILD_FLAGS`.

CI (`.github/workflows/web.yml`) runs lint, typecheck, test, build and size on every push
to `main` and every pull request, skipping docs-only changes.

No new dependencies beyond the fixed stack below. `package.json` overrides `react` with
`@preact/compat`, so React-based libraries (TanStack Query) run on Preact and real React
is never installed.

`api/openapi.yaml` is kept byte-for-byte as the backend publishes it (Prettier skips it).
After updating it, run `npm run gen:api` and commit `src/api/types.gen.ts`; CI fails if
the two disagree. Unit tests run against the mock API in `tests/msw` (300 generated
gateways, 5 models, and test users such as `admin@gwfleet.test` / `admin-pass`).

| File | What it is |
| --- | --- |
| `CLAUDE.md` | Rules Claude Code reads in every session. Copy to `web/CLAUDE.md`. |
| `docs/tasks/phase-1-foundation.md` | Sep 29–Oct 2: setup, design system, API client, shell and login |
| `docs/tasks/phase-2-fleet-views.md` | Oct 5–9: overview, device list, device detail, remote actions |
| `docs/tasks/phase-3-operate.md` | Oct 12–16: configuration, firmware and rollouts, alerts, users, e2e |

## Phases

| Phase | Dates | Ends when |
| --- | --- | --- |
| 1 Foundation | Sep 29–Oct 2 | Login works against the dev stack, roles change the UI, bundle under budget |
| 2 Fleet views | Oct 5–9 | Overview, device list and detail on live data; reboot, logs and ping work |
| 3 Operate | Oct 12–16 | Config push, firmware rollout, alerts and users done; Playwright flows green |

## How to run a task with Claude Code

1. Copy `CLAUDE.md` to `web/` in the backend repo (once).
2. Create a branch `task/<ID>`, for example `task/UI-05`.
3. Start Claude Code in the repo and send:

   ```text
   Read web/CLAUDE.md and api/openapi.yaml.
   Implement task <ID> from docs/tasks/<phase file> exactly as described.
   Stay inside the listed files. Do not add dependencies.
   When done, run every command under Evaluation and report the results.
   ```

4. Review the diff; check each Evaluation line passed.
5. Commit, push, open a GitLab merge request; CI must be green before merge.
6. Tick the task below.

Each card has: **Depends on**, **Goal**, **What to do**, **Unit tests**, **Results**,
**Evaluation** and **Notes**.

## Stack (fixed — do not swap)

Preact 10 + TypeScript, Vite 5, wouter (its Preact build, `wouter-preact`), TanStack Query v5, zod, plain CSS with custom
properties, inline SVG charts and icons, Vitest + Testing Library + MSW, Playwright.

No component library, no Tailwind, no Redux, no Axios, no date library, no chart or icon
package. A new dependency needs a line in the merge request saying what it replaces and
its gzipped size, and must keep the bundle under budget.

## Performance budget (CI blocks on the first three)

| Measure | Budget |
| --- | --- |
| Initial JS, gzipped | ≤ 120 KB |
| Initial CSS, gzipped | ≤ 15 KB |
| Largest lazy chunk | ≤ 40 KB |
| First load on office LAN | ≤ 1.0 s to interactive |
| Requests while idle on overview | ≤ 4 per minute |

## Checklist in build order

### Phase 1 (Sep 29–Oct 2)

- [x] UI-01 Project setup, CI stage and size gate
- [x] UI-02 Design tokens and ui components
- [x] UI-03 API client, generated types, MSW fixtures
- [ ] UI-04 App shell, router, session, login, role guards

### Phase 2 (Oct 5–9)

- [ ] UI-05 Overview
- [ ] UI-06 Device list
- [ ] UI-07 Device detail
- [ ] UI-08 Remote actions with job tracking

### Phase 3 (Oct 12–16)

- [ ] UI-09 Configuration: versions, diff, editor, push
- [ ] UI-10 Firmware and rollouts
- [ ] UI-11 Alerts and users
- [ ] UI-12 Playwright flows, accessibility, responsive, pilot fixes

## Backend dependencies

| Screen | Needs | Until then |
| --- | --- | --- |
| UI-04 | BE-01.3 auth, BE-01.4 spec | MSW fixtures from the spec |
| UI-05 | BE-03.3 overview | MSW |
| UI-06, UI-07 | BE-03.2, BE-03.3 | MSW |
| UI-08 | BE-05.3 actions | MSW |
| UI-09 | BE-07.1, BE-07.2, BE-07.3 | MSW |
| UI-10 | BE-08, BE-09.1 | MSW |
| UI-11 | BE-10, BE-01.3 users | MSW |

Every screen is built against MSW fixtures written from `api/openapi.yaml`, so the
frontend never waits for an endpoint.

## Out of scope for v1

Packages screen, MFA screen, audit log screen, API keys, multi-tenant views, maintenance
windows, SSE live updates (polling instead), dashboards beyond the overview.
