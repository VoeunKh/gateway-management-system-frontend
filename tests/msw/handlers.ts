import type { RequestHandler } from 'msw';
import { authHandlers } from './handlers/auth';
import { catalogHandlers } from './handlers/catalog';
import { configHandlers } from './handlers/configs';
import { deviceHandlers } from './handlers/devices';
import { userHandlers } from './handlers/users';

// Mock API built from api/openapi.yaml. Fixtures in ./fixtures are the only sample data;
// screens never embed their own. Rollouts, jobs, alerts and the overview join here once
// the spec defines them.
export const handlers: RequestHandler[] = [
  ...authHandlers,
  ...userHandlers,
  ...catalogHandlers,
  ...configHandlers,
  ...deviceHandlers,
];
