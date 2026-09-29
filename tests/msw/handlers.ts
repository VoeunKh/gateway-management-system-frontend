import type { RequestHandler } from 'msw';
import { alertHandlers } from './handlers/alerts';
import { authHandlers } from './handlers/auth';
import { catalogHandlers } from './handlers/catalog';
import { configHandlers } from './handlers/configs';
import { deviceHandlers } from './handlers/devices';
import { firmwareHandlers } from './handlers/firmware';
import { jobHandlers } from './handlers/jobs';
import { overviewHandlers } from './handlers/overview';
import { rolloutHandlers } from './handlers/rollouts';
import { telemetryHandlers } from './handlers/telemetry';
import { userHandlers } from './handlers/users';

// Mock API built from api/openapi.yaml and the draft api/proposed.yaml. Fixtures in
// ./fixtures are the only sample data; screens never embed their own.
export const handlers: RequestHandler[] = [
  ...authHandlers,
  ...userHandlers,
  ...catalogHandlers,
  ...configHandlers,
  ...deviceHandlers,
  ...overviewHandlers,
  ...alertHandlers,
  ...rolloutHandlers,
  ...firmwareHandlers,
  ...jobHandlers,
  ...telemetryHandlers,
];
