import type { Schemas } from '@/api/endpoints';

export const DEFAULT_WAVES = '1,10,50,100';
export const DEFAULT_THRESHOLD = '10';

export interface RolloutFormValues {
  model: string;
  version: string;
  waves: string;
  threshold: string;
}

export interface RolloutFormResult {
  wavesError?: string;
  thresholdError?: string;
  /** Set only when the form has no errors. */
  request?: Schemas['RolloutRequest'];
}

/** "1, 10,50" -> [1, 10, 50]; null for anything that is not whole percentages. */
export function parseWaves(text: string): number[] | null {
  const parts = text.split(',').map((part) => part.trim());
  if (parts.some((part) => !/^\d+$/.test(part))) return null;
  const waves = parts.map(Number);
  return waves.every((w) => w >= 1 && w <= 100) ? waves : null;
}

/** The same rules the server applies, so people are not sent there to find out. */
export function checkRolloutForm(values: RolloutFormValues): RolloutFormResult {
  const waves = parseWaves(values.waves);
  const threshold = Number(values.threshold);
  const result: RolloutFormResult = {};
  if (!waves) result.wavesError = 'Enter whole percentages from 1 to 100, like 1,10,50,100.';
  else if (waves.some((w, i) => i > 0 && w <= (waves[i - 1] ?? 0))) {
    result.wavesError = 'Waves must go up, like 1,10,50,100.';
  } else if (waves[waves.length - 1] !== 100) result.wavesError = 'Waves must end at 100.';
  if (!/^\d+$/.test(values.threshold.trim()) || threshold < 1 || threshold > 100) {
    result.thresholdError = 'Failure threshold must be between 1 and 100.';
  }
  if (!result.wavesError && !result.thresholdError && waves && values.model && values.version) {
    result.request = {
      model_id: values.model,
      fw_version: values.version,
      waves,
      failure_threshold: threshold,
    };
  }
  return result;
}
