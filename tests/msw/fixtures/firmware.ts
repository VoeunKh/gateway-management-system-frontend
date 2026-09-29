import type { DeviceView, Schemas } from '@/api/endpoints';
import { MODELS } from './catalog';
import { hex, seeded } from './random';

type Image = Schemas['FirmwareImage'];

/** The signature the mock accepts; anything else is "signature_invalid". */
export const VALID_SIGNATURE = 'GWSIG-OK';

export const imageFileName = (modelId: string, version: string) =>
  `${modelId.toLowerCase()}-openwrt-23.05.4-${version}-squashfs-sysupgrade.bin`;

/** One image per model and version the fleet runs; the newest of a model with several is beta. */
export function buildFirmware(devices: DeviceView[]): Image[] {
  const rand = seeded(777);
  return MODELS.flatMap(({ model, firmware }) =>
    firmware.map((version, i): Image => {
      const blocked = model.id === 'GW400' && version === '3.0.0';
      return {
        id: `fw-${model.id.toLowerCase()}-${version}`,
        model_id: model.id,
        version,
        channel: firmware.length > 2 && i === firmware.length - 1 ? 'beta' : 'stable',
        size: rand.int(7_400_000, 11_800_000),
        file_name: imageFileName(model.id, version),
        sha256: hex(rand.next, 64),
        gateways: devices.filter((d) => d.model_id === model.id && d.fw_version === version).length,
        blocked,
        blocked_reason: blocked ? 'Boot loop on hardware revision B1' : null,
      };
    }),
  );
}
