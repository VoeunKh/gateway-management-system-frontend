// Every polling interval in the console. Hooks read from here; nothing else sets a
// refetchInterval. Background tabs never poll (see queryClient.ts).
export const POLL_MS = {
  rollout: 5_000,
  job: 3_000,
  overview: 30_000,
  /** Sync counts on the config page for a minute after a push, while gateways apply it. */
  push: 3_000,
  /**
   * The overview's fleet board: every gateway, two pages of 200. The header counts come
   * from /overview every 30 s, so the squares can lag; slow enough to keep an idle overview
   * near 4 requests a minute until /overview carries the board itself.
   */
  board: 240_000,
  /** Progress of active rollouts on the overview; the Firmware page polls them live. */
  rolloutsSummary: 120_000,
  alerts: 30_000,
  /** The rail's open-alert count, on every screen; the Alerts page itself uses `alerts`. */
  alertBadge: 60_000,
  devices: 30_000,
  metrics: 60_000,
} as const;

export type PollTarget = keyof typeof POLL_MS;
