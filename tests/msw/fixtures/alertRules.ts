import type { Schemas } from '@/api/endpoints';

/** The rules the alert fixtures are raised by. */
export const ALERT_RULES: Schemas['AlertRule'][] = [
  {
    id: 'offline',
    name: 'No heartbeat',
    condition: 'The gateway has not reported for 10 minutes',
    severity: 'warning',
  },
  {
    id: 'temp_high',
    name: 'Temperature high',
    condition: 'Temperature at or above 80 °C',
    severity: 'critical',
  },
  {
    id: 'mem_high',
    name: 'Memory high',
    condition: 'RAM use at or above 90%',
    severity: 'critical',
  },
  {
    id: 'health_warning',
    name: 'Running hot or low on memory',
    condition: 'Temperature 72 °C or more, RAM 80% or more, or under 8 MB free in /tmp',
    severity: 'warning',
  },
  {
    id: 'package_drift',
    name: 'Packages differ',
    condition: "Installed packages differ from the firmware's manifest",
    severity: 'info',
  },
];
