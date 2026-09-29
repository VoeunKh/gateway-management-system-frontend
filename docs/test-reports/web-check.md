# Web console check report

Status at the end of the UI build. **What was measured, what was checked by hand, and what
still needs a person or the office network.** Nothing here is marked done that was not run.

## Automated, run on every change

| Check | Result |
| --- | --- |
| `npm run lint`, `typecheck` | pass |
| `npm test` (Vitest + Testing Library + MSW) | 320 tests pass |
| `npm run build`, `npm run size` | initial JS 30.9 kB gz (limit 120), CSS 5.8 kB gz (limit 15), largest lazy chunk 6.7 kB gz (limit 40) |
| `npm run e2e` (Playwright, 1280 px and 375 px) | 26 tests pass: roles, device search, config, users, packages, push, rollout, alert, remote action, keyboard |
| Coverage of the feature folders the task cards set targets for | overview 99%, config 97%, firmware 97%, alerts 97%, packages 94% (targets 80–85%) |

## Flows (task card UI-12), at both widths

| # | Flow | Spec |
| --- | --- | --- |
| 1 | Admin, release engineer and viewer each see the right navigation and controls | `roles.spec.ts` |
| 2 | Search a gateway by MAC, open it, read its interfaces | `devices.spec.ts` |
| 3 | Push a config version and watch the drifted count fall | `operate.spec.ts` |
| 4 | Start a rollout, watch a wave, pause it, abort it | `operate.spec.ts` |
| 5 | Acknowledge an alert | `operate.spec.ts` (the alert stays open once acknowledged, so the rail count does not change; it shows who did it) |

Also covered: config editing with a line error, users, packages, a remote ping with its job
panel and history, and the firmware screen by keyboard alone.

These run against the mock API (MSW answered from Node), not a real backend or gateway
simulator. The nightly workflow (`.github/workflows/e2e.yml`) runs them.

## Measured

- **Idle overview request rate:** 16 requests in 4 minutes = **4 a minute** (limit 4), with
  rollouts and alerts present, Chromium, desktop width. It was 7 before the board and rollout
  polls were slowed; see `docs/api-requests.md` (1) for how the backend can bring it to 2.
- **Bundle:** see the table above. The Firmware screen chunk is 5.4 kB gz.

## Checked by hand in Chromium (screenshots reviewed)

Every screen at **1280 px and 375 px, light and dark**, with no horizontal page scroll
(asserted as `scrollWidth ≤ viewport` in throw-away Playwright scripts while taking the
screenshots; it is not a permanent test):

Overview, Devices, Device detail (with trend chart, history, job panel, rollout banner),
Configuration (including the push dialog), Firmware and rollouts (live rollout, wave board,
upload and block dialogs), Packages, Alerts, Users, Login.

Tables that do not fit a phone (alerts, firmware images, finished rollouts) turn into
labelled cards under 640 px instead of scrolling sideways. The devices list keeps a
horizontally scrolling table on purpose.

Keyboard only: sign-in, rail navigation, device search, opening a gateway from the fleet
board, model pickers (arrow keys), dialogs (focus moves in, Tab wraps, Escape closes, focus
returns to the button that opened it), and the firmware screen. Focus is never trapped or
lost in these.

## Not done yet — needs a person, the office network, or a decision

| Item | Why it is open |
| --- | --- |
| `axe-core` accessibility checks in the flows | needs the dependency approved (CLAUDE.md: no new dependencies). Until then accessibility rests on role and label queries in every test, colour never carrying meaning alone, and the manual keyboard pass above |
| First load under 1.0 s on the office LAN | can only be measured there |
| Memory after 8 hours on the overview | needs a long-running session; polling is bounded (see the request rate above) and the fleet board renders 300 buttons without per-square state, but nothing has been observed over 8 hours |
| Real screen reader pass | only accessible names and roles have been checked, by test |
| Against the real dev stack with the simulator | the backend has not published actions, push, firmware, rollouts or alerts yet, so those screens run on the mock (`docs/api-requests.md`). Behaviour such as "the offline alert appears within its rule window" cannot be seen on a mock |
| Pilot fixes (Oct 14–16) | each will start from a failing test; nothing reported yet |

## Known limits of the mock

- Alerts do not appear or clear over time; they are a fixed set.
- A rollout advances one step per second of real time (configurable), so its pace is not a
  real gateway's.
- The signature check accepts any `.sig` starting with `GWSIG-OK`.
