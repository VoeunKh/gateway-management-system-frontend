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

CI (`.github/workflows/web.yml`) runs lint, typecheck, test, build and size on every push
to `main` and every pull request, skipping docs-only changes.

No new dependencies beyond the fixed stack below.

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

Preact 10 + TypeScript, Vite 5, wouter, TanStack Query v5, zod, plain CSS with custom
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

- [ ] UI-01 Project setup, CI stage and size gate
- [ ] UI-02 Design tokens and ui components
- [ ] UI-03 API client, generated types, MSW fixtures
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
