import { POLL_MS } from '@/api/polling';
import type { PollTarget } from '@/api/polling';

/** Shortens polling intervals for one test (the real ones are seconds); restored afterwards. */
export function fastPolling(ms: number, targets: PollTarget[] = ['job', 'rollout']) {
  const before = { ...POLL_MS };
  for (const target of targets) (POLL_MS as Record<PollTarget, number>)[target] = ms;
  onTestFinished(() => {
    Object.assign(POLL_MS, before);
  });
}
