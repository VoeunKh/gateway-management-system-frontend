import type { Schemas } from '@/api/endpoints';

type Entry = Schemas['HistoryEntry'];

const TYPE_LABEL: Record<string, string> = {
  provisioned: 'Provisioned',
  cfg_applied: 'Config applied',
  fw_updated: 'Firmware updated',
  offline: 'Went offline',
  online: 'Came online',
  reboot: 'Reboot',
  logs: 'Pull logs',
  ping: 'Ping test',
};

/** "cfg_applied" -> "Config applied"; unknown tags become sentence case. */
export function typeLabel(entry: Entry): string {
  const known = TYPE_LABEL[entry.type];
  if (known) return known;
  const text = entry.type.replace(/[_-]+/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A job's detail is text; an event's is an object, whose `message` wins, else its fields. */
export function describe(entry: Entry): string {
  const { detail } = entry;
  if (typeof detail === 'string') return detail;
  if (!isRecord(detail)) return '';
  if (typeof detail.message === 'string') return detail.message;
  if ('from' in detail && 'to' in detail) return `${String(detail.from)} → ${String(detail.to)}`;
  if ('version' in detail) return `v${String(detail.version)}`;
  return Object.entries(detail)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(', ');
}
