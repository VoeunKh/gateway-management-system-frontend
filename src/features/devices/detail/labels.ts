import type { Schemas } from '@/api/endpoints';
import type { Tone } from '@/ui';

type Device = Schemas['DeviceDetail'];

export const LIFECYCLE_LABEL: Record<Device['lifecycle'], string> = {
  active: 'Active',
  decommissioned: 'Decommissioned',
  bricked: 'Bricked',
};

export const PACKAGE_DRIFT_LABEL: Record<Device['package_drift'], string> = {
  ok: 'Matches its firmware',
  drift: 'Differs from its firmware',
  unknown: 'Unknown (no manifest for this firmware)',
};

export const PACKAGE_STATUS: Record<
  Schemas['PackageStatus']['status'],
  { tone: Tone; label: string }
> = {
  ok: { tone: 'ok', label: 'Matches' },
  drift: { tone: 'warn', label: 'Differs' },
  not_in_manifest: { tone: 'neutral', label: 'Not in manifest' },
  unknown: { tone: 'neutral', label: 'Unknown' },
};

const INTERFACE_LABEL: Record<string, string> = { mac: 'MAC', imei: 'IMEI', iccid: 'ICCID' };
export const interfaceLabel = (type: string) => INTERFACE_LABEL[type] ?? type.toUpperCase();

/** /tmp below this many KB is a health warning (the spec's threshold). */
export const LOW_TMP_KB = 8192;
