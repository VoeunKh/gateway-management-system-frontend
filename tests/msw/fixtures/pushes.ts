import { db } from '../db';

/** Gateways a push reaches: the model's active ones. */
export const pushTargets = (modelId: string) =>
  db.devices.filter((d) => d.model_id === modelId && d.lifecycle === 'active');

/** Makes `version` the model's target and queues the apply. Returns how many gateways. */
export function startPush(modelId: string, version: number): number {
  for (const d of db.devices.filter((x) => x.model_id === modelId)) {
    d.target_cfg_version = version;
    d.drift = d.cfg_version !== version;
  }
  db.pushes.push({ model: modelId, version, at: Date.now() });
  return pushTargets(modelId).length;
}

/**
 * Online gateways apply a pushed version one after another, `pushStepMs` apart, so a page
 * polling the fleet sees drift fall. Offline ones keep it until they reconnect (never, here).
 * Called before the device handlers answer.
 */
export function settlePushes(now = Date.now()) {
  for (const push of db.pushes) {
    pushTargets(push.model)
      .filter((d) => d.online && d.cfg_version !== push.version)
      .forEach((d, i) => {
        if (now < push.at + (i % 8) * db.pushStepMs) return;
        d.cfg_version = push.version;
        d.drift = false;
        d.cfg_hash = `${push.version}`.padStart(64, 'a');
      });
  }
}
