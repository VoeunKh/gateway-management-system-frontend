# Phase 2: Fleet views (Oct 5 – 9)

Phase 2 ends when the overview, device list and device detail run on live data, and an
admin can reboot a gateway, pull its logs and run a ping from the console.

Order: UI-05 → UI-06 → UI-07 → UI-08.

Each screen is built against MSW fixtures first, then pointed at the dev stack once the
backend task it depends on is merged.

---

## UI-05 Overview

**Depends on:** UI-04, BE-03.3 (MSW until then)

**Goal:** one screen that answers "is the fleet healthy, and is anything running?".

**What to do**

1. `features/overview/OverviewPage.tsx` using `useOverview()` (poll 30 s from
   `api/polling.ts`).
2. `FleetBoard`: one square per gateway grouped by model, coloured by health. Each square
   is a `<button>` with `aria-label="GW200-0012, critical, firmware 1.2.0"` that routes to
   the device. Grid wraps; no fixed columns.
3. `FirmwareSplit`: one stacked bar per model showing the version mix, with a text legend
   (version and count). Bars are `<div>`s sized by percentage, with `role="img"` and an
   `aria-label` naming the split.
4. `RolloutMini`: for each active rollout, id, model, target version, state badge,
   done/total and a progress bar; links to `/firmware`.
5. `AlertsPreview`: the 5 newest open alerts (severity, SN, message, age) with a link to
   `/alerts`; admin sees an Acknowledge button per row.
6. Header line: total gateways, online count, count needing attention, drift count.
7. Loading skeleton, empty state ("No gateways yet — install the agent to get started"),
   error state with Retry.

**Unit tests**

- Header counts computed from the fixture match the fixture's numbers.
- FleetBoard renders one button per device with the right health class and label;
  clicking one routes to `/devices/:sn`.
- FirmwareSplit widths sum to 100% per model; legend lists every version with counts.
- RolloutMini hidden when no active rollout; shows state badge text for running, soaking
  and paused.
- AlertsPreview shows at most 5; Acknowledge visible for admin, absent for viewer.
- Loading, empty and error states each render.

**Results:** overview page and its four components.

**Evaluation**

- `npm test` passes; `features/overview` coverage ≥ 80%.
- Against the dev stack with 300 simulated gateways, the page loads in under 1 s and the
  counts match `GET /overview`.
- Idle on this screen, network panel shows ≤ 4 requests per minute; switching to another
  browser tab stops them.
- Keyboard: tab through the board, Enter opens a device; screen reader announces the
  label.

**Notes:** the board must stay readable at 300 squares — no per-square tooltips library,
just `title` plus `aria-label`.

---

## UI-06 Device list

**Depends on:** UI-05, BE-03.2 (MSW until then)

**Goal:** find any gateway in a few seconds, by serial number, site, MAC, IMEI or ICCID.

**What to do**

1. `features/devices/DevicesPage.tsx`: search box (debounce 300 ms), model filter, health
   filter, drift toggle; filters live in the URL query string so a view can be shared and
   survives reload.
2. `useDevices(filters)` with `useInfiniteQuery`, 100 rows per page, "Load more" button,
   `placeholderData: keepPreviousData` so the table does not flash while typing.
3. Table columns: status (dot plus label), SN, model and hardware rev, site, firmware,
   config version with a Drift badge, temperature, last seen (relative time).
4. Row click and Enter open the device; the row is a real link for middle-click and
   "open in new tab".
5. Footer: "Showing X of Y gateways" plus the active filter chips with clear buttons.
6. States: skeleton rows while loading, empty state naming the filters that matched
   nothing with a Clear filters action, error state with Retry.

**Unit tests**

- Typing in search debounces and produces one request with the right `q` parameter.
- Each filter maps to the right query parameter; URL updates and reloading restores them.
- Load more appends rather than replaces; cursor passed from `next_cursor`.
- Empty result shows the empty state with a working Clear filters action.
- Drift badge appears only when expected and last-seen formatting matches `Intl`.
- Row link has an href and Enter activates it.

**Results:** device list page, filters, table, paging.

**Evaluation**

- `npm test` passes; coverage ≥ 80%.
- Against 300 simulated gateways: searching a MAC from one of them returns that device;
  first render of 100 rows under 100 ms (measured with the React profiler or a Vitest
  benchmark).
- Filters survive a page reload and can be shared as a URL.
- At 375 px the table scrolls sideways without breaking the layout.

**Notes:** do not virtualise. With 100 rows per page plain rendering is faster and far
simpler; revisit only above 500 rows.

---

## UI-07 Device detail

**Depends on:** UI-06, BE-03.2 and BE-03.3 (MSW until then)

**Goal:** everything known about one gateway on a single page.

**What to do**

1. `features/devices/DeviceDetailPage.tsx` with `useDevice(sn)`, `useDeviceMetrics(sn)`
   (poll 60 s) and `useDeviceHistory(sn)`.
2. Header: SN, health dot and label, model, site, last seen, plus the action buttons
   (UI-08 fills them in).
3. Two cards: Device info (SN, model, hardware rev, SoC, RAM and flash, OS, firmware,
   uptime) and Health (temperature, CPU, RAM, /tmp free with a warning when under 8 MB,
   LTE signal when present) with the temperature `Sparkline`.
4. Hardware interfaces table: type, name, identifier, link up or down.
5. Packages table (installed vs latest) — render only if the API returns packages, since
   packages are a v2 feature.
6. Config card: desired vs reported version, In sync or Drift badge, and the rendered
   config in a `<pre>` with secrets already masked by the server.
7. History table: time and message, newest first.
8. Banners: "needs on-site recovery" when the device is bricked; "in rollout R-014:
   downloading 42%" when a rollout job is active.
9. Back link to the device list preserving the previous filters.

**Unit tests**

- Every card renders from the fixture; missing optional fields (no LTE, no packages) hide
  their rows instead of showing blanks.
- Drift badge reflects desired vs reported.
- Bricked banner shows only when the flag is set; rollout banner shows the job state and
  percentage.
- Sparkline receives the metric values and renders; empty metrics show "No data yet".
- History renders newest first with formatted times.
- `/tmp` under 8 MB shows the warning badge.

**Results:** device detail page and its cards.

**Evaluation**

- `npm test` passes; coverage ≥ 80%.
- Against the dev stack: open a simulated gateway — interfaces, health and history match
  the API; open a real lab gateway and confirm the same.
- Dark mode and 375 px both readable; no horizontal page scroll.

**Notes:** the rendered config is server-masked; never build a masking step in the client,
and never log the config text.

---

## UI-08 Remote actions with job tracking

**Depends on:** UI-07, BE-05.3 (MSW until then)

**Goal:** an admin runs a remote action and can see what happened without leaving the page.

**What to do**

1. Action buttons on the device page: Reboot, Pull logs, Run ping — each wrapped in
   `<Can perm="remote">`, disabled while the device is offline with a `title` saying why.
2. Reboot opens a confirm dialog requiring the SN to be typed; the others run directly.
3. `useCreateAction(sn)` posts to `/devices/{sn}/actions`, shows a toast with the job id,
   then `useJob(jobId)` polls every 3 s until the job reaches a final state.
4. A `JobPanel` under the header shows the running job: type, state, progress bar for
   downloads, elapsed time, and a Cancel button while the job is still pending.
5. On success: ping shows its `detail` line (loss and average) in the panel; logs shows a
   Download logs button that calls `GET /jobs/{id}/logs` and opens the returned link;
   reboot shows "Gateway is rebooting" and the health dot follows the device back online.
6. On failure: the panel shows the error code and message from the API, with a Retry
   button that creates a new job.
7. Only one action of each type can be pending; a second attempt shows the 409 message.

**Unit tests**

- Buttons disabled for viewer and release with the role tooltip; enabled for admin.
- Buttons disabled when the device is offline.
- Reboot confirm requires the exact SN before the button enables.
- Action posts the right body and shows the toast with the job id.
- Job polling stops on a final state (succeeded, failed, timed out, cancelled).
- Ping detail rendered; logs Download button appears only after success.
- Failure shows code and message and offers Retry; 409 shows its message.

**Results:** action buttons, confirm dialog, job panel, job hooks.

**Evaluation**

- `npm test` passes; coverage ≥ 80%.
- Against the dev stack with a simulated gateway: ping returns a result in the panel;
  logs produces a downloadable file; reboot takes the device offline and back.
- Polling stops once the job ends (check the network panel).
- Whole flow usable by keyboard only.

**Notes:** never poll a finished job. The panel is the only place job state is shown on
this page; do not also mirror it in a toast.
