import { useState } from 'preact/hooks';
import { Badge, TONES } from '../Badge';
import { Button } from '../Button';
import { Dialog } from '../Dialog';
import { Field } from '../Field';
import { ICONS, IconRefresh } from '../icons';
import { Sparkline } from '../Sparkline';
import { EmptyState, ErrorState, Skeleton } from '../states';
import { Table } from '../Table';
import { ToastProvider, useToast } from '../Toast';
import { Tooltip } from '../Tooltip';
import './gallery.css';

// Dev-only visual check of every ui component (served at /ui by `npm run dev`).
// Not sample data for screens: those use tests/msw fixtures.

const ROLE_MESSAGE = "Your role (Viewer) can't do this";
const TONE_LABELS = ['Online', 'Degraded', 'Offline', 'Updating', 'Unknown'];
const ROWS = [
  { id: 'gw-0001', model: 'RUTX11', rssi: -71, trend: [-80, -78, -75, -74, -72, -71] },
  { id: 'gw-0002', model: 'RUT955', rssi: -93, trend: [-85, -88, -90, -95, -94, -93] },
  { id: 'gw-0003', model: 'RUTX50', rssi: -64, trend: [] },
];

function ThemeSwitch() {
  const [theme, setTheme] = useState('system');
  const apply = (value: string) => {
    setTheme(value);
    if (value === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = value;
  };
  return (
    <label class="row">
      Theme
      <select value={theme} onChange={(e) => apply(e.currentTarget.value)}>
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}

function Overlays() {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  return (
    <section>
      <h2>Dialog and Toast</h2>
      <div class="row">
        <Button variant="danger" onClick={() => setOpen(true)}>
          Reboot…
        </Button>
        <Button onClick={() => toast({ message: 'Reboot queued for gw-0001', tone: 'ok' })}>
          Success toast
        </Button>
        <Button onClick={() => toast({ message: 'Push failed on 3 devices', tone: 'danger' })}>
          Error toast
        </Button>
        <Button onClick={() => toast({ message: 'Rollout paused', tone: 'info' })}>
          Info toast
        </Button>
      </div>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Reboot gw-0001?"
        actions={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => setOpen(false)}>
              Reboot
            </Button>
          </>
        }
      >
        <Field label="Type the device ID to confirm" hint="gw-0001" />
      </Dialog>
    </section>
  );
}

export function Gallery() {
  return (
    <ToastProvider>
      <main class="gallery">
        <header>
          <h1>ui gallery</h1>
          <ThemeSwitch />
        </header>

        <section>
          <h2>Button</h2>
          <div class="row">
            <Button variant="primary">Primary</Button>
            <Button>Secondary</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="ghost">Ghost</Button>
            <Button size="sm" icon={<IconRefresh />}>
              Small with icon
            </Button>
            <Button variant="primary" disabled title={ROLE_MESSAGE}>
              Disabled
            </Button>
            <Button variant="primary" loading>
              Loading
            </Button>
          </div>
        </section>

        <section>
          <h2>Badge and Tooltip</h2>
          <div class="row">
            {TONES.map((tone, i) => (
              <Badge key={tone} tone={tone}>
                {TONE_LABELS[i]}
              </Badge>
            ))}
            <Tooltip text="Last seen 2 minutes ago">Hover for a tooltip</Tooltip>
          </div>
        </section>

        <section>
          <h2>Field</h2>
          <div class="grid">
            <Field label="Email" type="email" autoComplete="username" />
            <Field label="APN" hint="From the SIM provider" />
            <Field label="Password" type="password" error="Wrong email or password" />
          </div>
        </section>

        <section>
          <h2>Table and Sparkline</h2>
          <Table
            caption="Devices"
            rows={ROWS}
            rowKey={(row) => row.id}
            columns={[
              { key: 'id', header: 'Device', cell: (row) => row.id },
              { key: 'model', header: 'Model', cell: (row) => row.model },
              { key: 'rssi', header: 'RSSI (dBm)', cell: (row) => row.rssi, numeric: true },
              {
                key: 'trend',
                header: 'Last 6 h',
                cell: (row) =>
                  row.trend.length ? (
                    <Sparkline values={row.trend} label={`RSSI trend for ${row.id}`} />
                  ) : (
                    <span class="muted">No data</span>
                  ),
              },
            ]}
          />
        </section>

        <Overlays />

        <section>
          <h2>Screen states</h2>
          <div class="grid">
            <Skeleton label="Loading devices" />
            <EmptyState title="No devices match">Try a different model or status.</EmptyState>
            <ErrorState message="The server did not respond." onRetry={() => undefined} />
          </div>
        </section>

        <section>
          <h2>Icons</h2>
          <div class="row">
            {Object.entries(ICONS).map(([name, Icon]) => (
              <span key={name} class="icon-cell">
                <Icon size={24} />
                {name}
              </span>
            ))}
          </div>
        </section>
      </main>
    </ToastProvider>
  );
}
