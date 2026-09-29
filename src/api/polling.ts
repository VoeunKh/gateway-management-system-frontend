// Every polling interval in the console. Hooks read from here; nothing else sets a
// refetchInterval. Background tabs never poll (see queryClient.ts).
export const POLL_MS = {
  rollout: 5_000,
  job: 3_000,
  overview: 30_000,
  /** The overview's fleet board: every gateway, two pages of 200 at most. */
  board: 60_000,
  alerts: 30_000,
  devices: 30_000,
  metrics: 60_000,
} as const;

export type PollTarget = keyof typeof POLL_MS;
