import { HttpResponse, http } from 'msw';
import type { Schemas } from '@/api/endpoints';
import { denyUnless } from '../auth';
import { db } from '../db';
import { isLive } from '../fixtures/rolloutSim';
import { api } from './api';

const isOpen = (alert: Schemas['Alert']) => alert.resolved_at === null;

/** GET /overview, counted from the same devices, rollouts and alerts the other handlers use. */
export function buildOverview(): Schemas['Overview'] {
  const health: Schemas['OverviewHealth'] = { healthy: 0, warning: 0, critical: 0, offline: 0 };
  for (const device of db.devices) health[device.health] += 1;
  const models = db.models.map(({ model }) => {
    const fleet = db.devices.filter((d) => d.model_id === model.id);
    const counts = new Map<string, number>();
    for (const { fw_version: fw = '' } of fleet) counts.set(fw, (counts.get(fw) ?? 0) + 1);
    return {
      model_id: model.id,
      model_name: model.name,
      devices: fleet.length,
      firmware: [...counts].map(([fw_version, devices]) => ({ fw_version, devices })),
    };
  });
  return {
    devices: db.devices.length,
    health,
    models,
    active_rollouts: db.rollouts.filter(isLive).length,
    open_alerts: db.alerts.filter(isOpen).length,
  };
}

export const overviewHandlers = [
  http.get(api('/overview'), ({ request }) => {
    const denied = denyUnless(request);
    return denied ?? HttpResponse.json(buildOverview());
  }),
];
