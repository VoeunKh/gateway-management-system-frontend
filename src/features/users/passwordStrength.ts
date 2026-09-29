import type { Tone } from '@/ui';

export interface Strength {
  label: string;
  tone: Tone;
}

/**
 * A hint only: the server decides what it accepts. Length counts most; mixing letter case,
 * digits and symbols adds a little.
 */
export function passwordStrength(password: string): Strength | null {
  if (!password) return null;
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  const score =
    password.length >= 16 ? 3 : password.length >= 12 ? 2 : password.length >= 8 ? 1 : 0;
  const total = score + (kinds >= 3 ? 1 : 0);
  if (password.length < 8) return { label: 'Too short: use at least 8 characters', tone: 'danger' };
  if (total <= 1) return { label: 'Weak: longer is better', tone: 'warn' };
  if (total === 2) return { label: 'Fair', tone: 'info' };
  return { label: 'Strong', tone: 'ok' };
}
