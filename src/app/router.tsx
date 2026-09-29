import { Suspense, lazy } from 'preact/compat';
import { Link, Redirect, Route, Switch, useLocation, useSearch } from 'wouter-preact';
import { LoginPage } from '@/auth/LoginPage';
import { RequireRole } from '@/auth/guards';
import { useSession } from '@/auth/session';
import { OverviewPage } from '@/features/overview/OverviewPage';
import { EmptyState, Skeleton } from '@/ui';
import { Shell } from './Shell';

// Login and overview ship in the initial bundle; every other screen is its own chunk.
const DevicesPage = lazy(() =>
  import('@/features/devices/DevicesPage').then((m) => ({ default: m.DevicesPage })),
);
const DeviceDetailPage = lazy(() =>
  import('@/features/devices/DeviceDetailPage').then((m) => ({ default: m.DeviceDetailPage })),
);
const ConfigPage = lazy(() =>
  import('@/features/config/ConfigPage').then((m) => ({ default: m.ConfigPage })),
);
const FirmwarePage = lazy(() =>
  import('@/features/firmware/FirmwarePage').then((m) => ({ default: m.FirmwarePage })),
);
const AlertsPage = lazy(() =>
  import('@/features/alerts/AlertsPage').then((m) => ({ default: m.AlertsPage })),
);
const UsersPage = lazy(() =>
  import('@/features/users/UsersPage').then((m) => ({ default: m.UsersPage })),
);

function NotFound() {
  return (
    <section class="page">
      <EmptyState title="Page not found" action={<Link href="/">Go to the overview</Link>}>
        The address may be mistyped, or the page has moved.
      </EmptyState>
    </section>
  );
}

function SignedIn() {
  const { status } = useSession();
  const [path] = useLocation();
  const search = useSearch();

  if (status === 'loading') {
    return (
      <main class="page">
        <Skeleton lines={4} label="Checking your session" />
      </main>
    );
  }
  if (status === 'anonymous') {
    const back =
      path === '/' && !search
        ? ''
        : `?next=${encodeURIComponent(path + (search ? `?${search}` : ''))}`;
    return <Redirect to={`/login${back}`} replace />;
  }

  return (
    <Shell>
      <Suspense fallback={<Skeleton lines={6} label="Loading page" />}>
        <Switch>
          <Route path="/" component={OverviewPage} />
          <Route path="/devices" component={DevicesPage} />
          <Route path="/devices/:sn">{(params) => <DeviceDetailPage sn={params.sn} />}</Route>
          <Route path="/config" component={ConfigPage} />
          <Route path="/firmware" component={FirmwarePage} />
          <Route path="/alerts" component={AlertsPage} />
          <Route path="/users">
            <RequireRole min="admin" area="Users">
              <UsersPage />
            </RequireRole>
          </Route>
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </Shell>
  );
}

export function AppRoutes() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route component={SignedIn} />
    </Switch>
  );
}
