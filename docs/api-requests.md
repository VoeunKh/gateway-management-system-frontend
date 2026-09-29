# API requests from the web console

What the console still needs in `api/openapi.yaml`, screen by screen, in go-live order.
Everything the current spec provides is built (login, shell, device list and detail,
config versions and diff, users, Playwright flows). The screens below are waiting only on
these endpoints.

The shapes are **proposals**: the backend owns the contract. Change names and fields
freely; the console follows whatever lands in the spec (types are generated from it). Two
conventions we rely on, both already used by the current spec:

- errors as `{ "error": { "code", "message", "details" } }`, with stable `code` values;
- timestamps as RFC 3339 strings, sizes in bytes, percentages as 0–100 numbers.

## Summary

| # | For | Needs | Card | Backend task |
| --- | --- | --- | --- | --- |
| 1 | Overview | `GET /overview` | UI-05 | BE-03.3 |
| 2 | Remote actions | `POST /devices/{sn}/actions`, `GET /jobs/{id}`, `POST /jobs/{id}/cancel`, `GET /jobs/{id}/logs` | UI-08 | BE-05.3 |
| 3 | Config push | `POST …/configs/{v}/push/preview`, `POST …/configs/{v}/push` | UI-09 | BE-07.x |
| 4 | Firmware images | list, upload (image + signature), block / unblock | UI-10 | BE-08 |
| 5 | Rollouts | list, preview, create, get, pause / resume / abort | UI-10 | BE-09.1 |
| 6 | Alerts | list, acknowledge, rules | UI-11, UI-05, shell badge | BE-10 |
| 7 | Device detail extras | metrics history, events, a few fields | UI-07 | BE-03.x |
| 8 | Small additions | list total, list temperature, user disable | UI-06, UI-11 | BE-03.2, BE-01.3 |

Phase 2 (overview and remote actions) is due first; 1 and 2 unblock it.

## 1. Overview (UI-05)

One call for the whole screen, polled every 30 s, so the idle screen stays within the
"≤ 4 requests per minute" budget.

```yaml
GET /overview → 200
  totals:   { gateways: 300, online: 281, attention: 12, drifted: 9 }   # attention = warning + critical
  devices:  [ { sn, model_id, health, fw_version } ]                    # every gateway, for the fleet board
  firmware: [ { model_id, versions: [ { fw_version, count } ] } ]      # version mix per model
  rollouts: [ Rollout ]                                                 # active only (running, soaking, paused); see 5
  alerts:   [ Alert ]                                                   # 5 newest open; see 6
```

## 2. Remote actions and jobs (UI-08)

```yaml
POST /devices/{sn}/actions   { type: reboot | logs | ping } → 201 Job
  409 action_pending   # one of this type already pending for the device
  409 device_offline
  403                  # not admin

GET  /jobs/{id}         → 200 Job   # polled every 3 s until state is final
POST /jobs/{id}/cancel  → 200 Job   # only while pending; 409 otherwise
GET  /jobs/{id}/logs    → 200 { url, expires_at }   # a /dl/{token} link; 409 if the job didn't succeed

Job:
  id, type, sn, created_at, finished_at?     # finished_at null until final
  state: pending | running | succeeded | failed | timed_out | cancelled
  progress?: 0..100                          # logs upload, for the progress bar
  detail?:  string                           # ping: "0% loss, avg 42 ms"
  error?:   { code, message }                # when failed or timed_out
```

## 3. Config push (UI-09)

The push dialog shows who will get the version before anyone confirms.

```yaml
POST /models/{id}/configs/{v}/push/preview → 200 { gateways: 60, offline: 3 }
POST /models/{id}/configs/{v}/push         → 202 { jobs: 60 }
  # Afterwards target_cfg_version on the model's devices becomes {v}, so drift updates.
  403 (viewer), 404 (no such version)
```

## 4. Firmware images (UI-10)

```yaml
GET  /firmware?model={id}                  → 200 [ FirmwareImage ]
POST /firmware  multipart: model_id, version, channel, image, signature (.sig)
                                           → 201 FirmwareImage
  422 signature_invalid   # the console shows "This image's signature does not match…"
  409 version_exists
POST /firmware/{id}/block | /unblock       → 200 FirmwareImage

FirmwareImage:
  id, model_id, version, channel: stable | beta, size, file_name, sha256,
  gateways,                   # how many run this version now
  blocked, blocked_reason?    # blocked versions can't be picked for a rollout
```

Uploads go through the console's nginx, which accepts bodies up to `CLIENT_MAX_BODY_SIZE`
(512 MB by default). Please confirm the largest image size.

## 5. Rollouts (UI-10, and the overview's rollout panel)

```yaml
GET  /rollouts?state=active|finished       → 200 [ Rollout ]   # without waves[].devices
POST /rollouts/preview  RolloutRequest     → 200 RolloutPreview   # called as the form changes
POST /rollouts          RolloutRequest     → 201 Rollout
  422 invalid_waves | invalid_threshold | firmware_blocked
GET  /rollouts/{id}                        → 200 Rollout   # full, polled every 5 s while live
POST /rollouts/{id}/pause | /resume | /abort → 200 Rollout

RolloutRequest:  { model_id, fw_version, waves: [1, 10, 50, 100], failure_threshold: 1..100 }
RolloutPreview:  { need: 300, total: 300, waves: [3, 30, 150, 300],
                   offline_deferred: 12, skipped_low_tmp: 4 }
Rollout:
  id, model_id, fw_version, created_at, created_by,
  state: running | soaking | paused | completed | aborted,
  pause_reason?,                             # shown when auto-paused
  counters: { updated, in_progress, rolled_back, needs_recovery, skipped, deferred, waiting },
  waves: [ { percent, devices: [ { sn, state } ] } ]
  # device state: waiting | downloading | installing | updated | rolled_back
  #               | needs_recovery | skipped | deferred
```

The device detail page also wants the device's own rollout job for its banner ("in rollout
R-014: downloading 42%"). Either `DeviceDetail.rollout: { rollout_id, state, progress }`
or a filter such as `GET /rollouts?sn=`.

## 6. Alerts (UI-11, overview preview, shell badge)

```yaml
GET  /alerts?state=open|resolved&limit=    → 200 [ Alert ]   # open newest first; polled every 30 s
POST /alerts/{id}/ack                      → 200 Alert       # admin; 409 already acknowledged
GET  /alerts/rules                         → 200 [ { id, name, condition, severity } ]   # static v1 rules

Alert:
  id, sn, rule, severity: info | warning | critical, message,
  opened_at, resolved_at?, acked_by?, acked_at?
```

The rail's alert badge uses the open list's length, so the two can never disagree. A plain
`GET /alerts?state=open` is enough; no separate count endpoint is needed.

## 7. Device detail extras (UI-07)

```yaml
GET /devices/{sn}/metrics?since=24h        → 200 [ { time, temp_c, cpu_pct, mem_pct, signal_dbm } ]
                                             # temperature sparkline; polled every 60 s
GET /devices/{sn}/events?limit=50          → 200 [ { time, message } ]   # history, newest first

DeviceDetail, extra fields:  soc, ram_mb, flash_mb, os, uptime_s
HWInterface, extra fields:   name, link_up
```

## 8. Small additions

| Change | Why |
| --- | --- |
| `DeviceList.total`: count of all devices matching the filters | The list footer's "Showing X **of Y** gateways" (UI-06) |
| `temp_c` on list items (or `last_metrics` on `Device`) | The device list's temperature column (UI-06) |
| `User.disabled` and `PATCH /users/{id} { disabled }` | Disable and enable users instead of deleting them (UI-11) |
| `maximum: 200` on `limit` in `GET /devices` | The description says 200; the schema doesn't enforce it |
| One pagination style: `DeviceList.next_cursor` absent vs `CursorPage.next_cursor: null` | `CursorPage` is defined but unused; pick one before more lists arrive |

## How the console picks these up

1. The backend updates `api/openapi.yaml` and copies it into this repository byte for byte.
2. `npm run gen:api` regenerates `src/api/types.gen.ts` (CI fails if the two disagree).
3. The console adds endpoint functions and MSW mock handlers, then builds the screen
   against the mocks until the endpoint is deployed.
