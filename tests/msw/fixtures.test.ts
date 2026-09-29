import { db } from './db';
import { computeHealth } from './fixtures/devices';

describe('mock fleet', () => {
  it('has 300 devices over 5 models, sorted by SN', () => {
    expect(db.devices).toHaveLength(300);
    expect(new Set(db.devices.map((d) => d.model_id)).size).toBe(5);
    const sns = db.devices.map((d) => d.sn);
    expect(sns).toEqual([...sns].sort((a, b) => a.localeCompare(b)));
  });

  it('covers every health state, drift, bricked and unassigned devices', () => {
    const healths = new Set(db.devices.map((d) => d.health));
    expect([...healths].sort()).toEqual(['critical', 'healthy', 'offline', 'warning']);
    expect(db.devices.some((d) => d.drift)).toBe(true);
    expect(db.devices.some((d) => d.lifecycle === 'bricked')).toBe(true);
    expect(db.devices.some((d) => d.site_id === null)).toBe(true);
    expect(db.devices.some((d) => d.last_metrics === null)).toBe(true);
    expect(new Set(db.devices.map((d) => d.package_drift))).toEqual(
      new Set(['ok', 'drift', 'unknown']),
    );
  });

  it('computes health with the spec thresholds', () => {
    const m = { time: '', temp_c: 50, mem_pct: 50, tmp_free_kb: 20000 };
    expect(computeHealth(false, m)).toBe('offline');
    expect(computeHealth(true, null)).toBe('healthy');
    expect(computeHealth(true, { ...m, temp_c: 80 })).toBe('critical');
    expect(computeHealth(true, { ...m, mem_pct: 90 })).toBe('critical');
    expect(computeHealth(true, { ...m, temp_c: 72 })).toBe('warning');
    expect(computeHealth(true, { ...m, tmp_free_kb: 8000 })).toBe('warning');
    expect(computeHealth(true, m)).toBe('healthy');
  });
});
