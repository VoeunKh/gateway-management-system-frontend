import { cleanup } from '@testing-library/preact';
import { bench } from 'vitest';
import { db } from '../../../tests/msw/db';
import { toListItem } from '../../../tests/msw/fixtures/devices';
import { renderWithProviders } from '../../../tests/renderApp';
import { DeviceTable } from './DeviceTable';

// UI-06 budget: first render of 100 rows in under 100 ms. Run with `npx vitest bench`.
const hundred = db.devices.slice(0, 100).map(toListItem);

bench('DeviceTable: first render of 100 rows', () => {
  renderWithProviders(<DeviceTable devices={hundred} />);
  cleanup();
});
