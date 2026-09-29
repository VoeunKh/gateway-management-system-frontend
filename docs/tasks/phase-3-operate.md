# Phase 3: Operate (Oct 12 – 16)

Phase 3 ends at the go / no-go on Oct 16: a release engineer can push a config version and
drive a firmware rollout from the console, alerts and users work, and the Playwright flows
pass.

Order: UI-09 → UI-10 → UI-11 → UI-12. No new screens after Oct 14; the last two days are
tests and pilot fixes.

---

## UI-09 Configuration: versions, diff, editor, push

**Depends on:** UI-04, BE-07.1, BE-07.2, BE-07.3 (MSW until then)

**Goal:** a release engineer writes a new UCI version, sees exactly what changed, and
pushes it to a model with confidence.

**What to do**

1. `features/config/ConfigPage.tsx`: model selector (segmented control), target version
   line, in-sync and drifted counts, Push button wrapped in `<Can perm="config">`.
2. Version list: every version with number, note, author, date, and a Target badge on the
   current one; selecting a version shows it.
3. Diff view: selected version against the previous one, rendered from the API's diff
   response as added, removed and unchanged lines — colour plus a leading `+` / `-` so it
   reads without colour. Long files scroll inside the panel, not the page.
4. Editor: a plain `<textarea>` with monospace font, tab support, and a character count.
   Save posts the new version; a 422 renders the API's line number and message above the
   editor and highlights that line number in the gutter list.
5. Save is blocked with an inline message when the note is empty or the text is unchanged
   (mirroring the server rules, so people are not sent to the server to find out).
6. Push dialog: shows how many gateways will get the job and how many are offline, and
   requires the model id to be typed before the confirm button enables. On success a toast
   with the job count, then the drifted count refreshes.
7. Lazy-loaded route; this is the largest screen and must not be in the main chunk.

**Unit tests**

- Version list renders with the Target badge on the right version.
- Diff renders added, removed and unchanged lines with their prefixes; an empty diff shows
  "No changes".
- Editor: empty note blocks save with a message; unchanged text blocks save; 422 shows the
  line number and message from the API.
- Push dialog requires the exact model id; shows the counts from the preview response.
- Viewer sees the page read-only: no New version, no Push, editor disabled with tooltip.

**Results:** config page, version list, diff view, editor, push dialog.

**Evaluation**

- `npm test` passes; `features/config` coverage ≥ 85%.
- Against the dev stack: save an invalid template and see the line number; fix it, save,
  push to a model and watch the drifted count fall to zero as simulated gateways apply it.
- `npm run size`: the config chunk is its own lazy chunk, under 40 KB gzipped.

**Notes:** never re-implement UCI validation in the browser beyond the two cheap checks
above; the server is the single source of truth for syntax errors.

---

## UI-10 Firmware and rollouts

**Depends on:** UI-09, BE-08, BE-09.1 (MSW until then)

**Goal:** upload a signed image, plan the waves, start the rollout and watch it, with the
controls to stop it.

**What to do**

1. `features/firmware/FirmwarePage.tsx` with two parts: the rollout section and the image
   table.
2. Image table: model, version, channel badge, size, file name, short SHA-256 with a copy
   button, gateway count on that version, Block / Unblock button (`<Can perm="firmware">`).
3. Upload dialog: model, version, channel, image file, `.sig` file; shows upload progress;
   on 422 `signature_invalid` shows the message plainly ("This image's signature does not
   match — check it was signed with the release key").
4. Rollout form: model, target version (blocked versions disabled with a reason),
   wave percentages (default `1,10,50,100`) and failure threshold. Client-side checks
   mirror the server: ascending percentages ending at 100, threshold 1–100.
5. Preview: calls `POST /rollouts/preview` as the form changes (debounced 400 ms) and
   shows "X of Y gateways need this version; waves 3, 30, 150, 300; 12 offline will be
   deferred; 4 skipped for low /tmp".
6. `WaveBoard`: one square per gateway per wave, coloured by outcome, with a legend. Live
   rollouts poll every 5 s; each square is a button linking to the device with an
   `aria-label` naming its state.
7. Rollout controls: Pause, Resume, Abort (Abort requires typing the rollout id), each
   `<Can perm="rollout">`. The pause reason from the server is shown in a notice above the
   board when the rollout auto-paused.
8. Counters under the board: updated, in progress, rolled back, needs on-site recovery,
   skipped or deferred, waiting.
9. Finished rollouts collapse into a summary row with their counts.

**Unit tests**

- Form validation: `1,10,50` (not ending at 100), `50,10,100` (not ascending), threshold 0
  and 101 each show their message and block submit.
- Blocked firmware cannot be selected and shows why.
- Preview request is debounced and its numbers are rendered.
- WaveBoard renders a square per device with the right state class and label; legend lists
  every state.
- Pause and Resume call the right endpoints; Abort requires the exact rollout id.
- Auto-pause notice shows the server's reason text.
- Polling runs only while the rollout is running, soaking or paused.

**Results:** firmware page, upload dialog, rollout form, wave board, controls.

**Evaluation**

- `npm test` passes; `features/firmware` coverage ≥ 85%.
- Against the dev stack with 300 simulated gateways and a 30% failure rate: start a
  rollout, watch wave 1 fill, see it auto-pause with the reason, resume it, then abort.
- Upload a correctly signed image (accepted) and a tampered one (422 with a readable
  message).
- Polling stops once the rollout completes.

**Notes:** the wave board is the screen people stare at during an update — keep its render
cheap (no per-square component state) and its labels accurate.

---

## UI-11 Alerts and users

**Depends on:** UI-04, BE-10, BE-01.3 users (MSW until then)

**Goal:** close out the two remaining screens.

**What to do**

1. `features/alerts/AlertsPage.tsx`: open alerts table (severity, SN with link, message,
   age, Acknowledge for admin) and a recently resolved section; alert rules shown as a
   static reference table matching the backend's fixed v1 rules, with a line saying
   notifications are not wired up yet (Telegram is a TODO).
2. Acknowledge is optimistic: the row updates immediately and rolls back with a toast if
   the request fails.
3. `features/users/UsersPage.tsx` (admin only): table of users (name, email, role,
   disabled), Add user dialog (name, email, role, password with a strength hint), edit
   role, disable and enable. Password is never displayed or logged.
4. The alert count badge in the rail comes from the same query as this page, so they never
   disagree.

**Unit tests**

- Alerts: open list renders with severity labels; Acknowledge shown for admin only;
  optimistic update rolls back on failure with a toast.
- Empty state when there are no open alerts.
- Users: viewer and release are redirected away from `/users`; admin sees the table.
- Add user validates email format and required fields; role select offers exactly the
  three roles.
- Disabling a user updates the row.

**Results:** alerts page, users page.

**Evaluation**

- `npm test` passes; coverage ≥ 80%.
- Against the dev stack: stop a simulated gateway, watch the offline alert appear within
  its rule window, acknowledge it, restart the gateway and see it resolve.
- Create a user as admin, log in as that user in a private window, confirm their role's
  controls.

**Notes:** if the users screen is dropped from v1 (open decision), keep the alerts work and
say so in the merge request; `gwfleet admin user add` covers the gap.

---

## UI-12 Playwright flows, accessibility, responsive, pilot fixes

**Depends on:** UI-05 to UI-11

**Goal:** prove the console works end to end, for every role, on a phone and by keyboard,
and fix what the pilot finds.

**What to do**

1. `tests/e2e/` with Playwright against the dev Compose stack plus the simulator:
    1. log in as admin, release and viewer; each sees the right nav and controls;
    2. search a device by MAC, open it, read its interfaces;
    3. push a config version and watch drift clear;
    4. start a rollout, watch a wave, pause it, abort it;
    5. acknowledge an alert and see it leave the open list.
2. Run every flow twice: once at 1280 px, once at 375 px.
3. `axe-core` injected on each screen inside the flows; any serious or critical finding
   fails the run.
4. Manual pass recorded in `docs/test-reports/web-check.md`: keyboard-only walk of all 8
   screens, dark mode screenshots, first-load timing on the office network, and memory
   after 8 hours on the overview.
5. Fix what the pilot (Oct 14–16) reports; each fix starts with a failing test.
6. Add the console section to the go / no-go report: bundle sizes, flow results, open
   issues.

**Unit tests:** every pilot bug gets a unit or component test reproducing it before the fix.

**Results:** 5 Playwright flows, axe checks in CI, manual check report, pilot fixes.

**Evaluation**

- All 5 flows pass at both widths, twice in a row (no flaky tests).
- No serious or critical axe findings.
- Keyboard-only walk completes every flow; focus never trapped or lost.
- First load on the office LAN under 1.0 s; idle overview under 4 requests per minute.
- Zero critical or high console bugs open on Oct 16.

**Notes:** run the e2e suite in CI nightly, not on every merge, so the pipeline stays fast;
merges run unit tests and the size gate only.
