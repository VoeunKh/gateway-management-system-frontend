import type { ComponentChildren } from 'preact';
import { Link, useLocation } from 'wouter-preact';
import { ROLE_LABEL } from '@/auth/permissions';
import { useSession } from '@/auth/session';
import {
  Button,
  IconGateway,
  IconHome,
  IconPackage,
  IconSignOut,
  IconSliders,
  IconUpload,
  IconUser,
  IconWarning,
} from '@/ui';

interface NavItem {
  href: string;
  label: string;
  icon: ComponentChildren;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { href: '/', label: 'Overview', icon: <IconHome /> },
  { href: '/devices', label: 'Devices', icon: <IconGateway /> },
  { href: '/firmware', label: 'Firmware', icon: <IconUpload /> },
  { href: '/packages', label: 'Packages', icon: <IconPackage /> },
  { href: '/config', label: 'Configuration', icon: <IconSliders /> },
  { href: '/alerts', label: 'Alerts', icon: <IconWarning /> },
  { href: '/users', label: 'Users', icon: <IconUser />, adminOnly: true },
];

const isActive = (href: string, path: string) =>
  href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`);

export interface ShellProps {
  /** Open alerts for the rail badge; omitted until the API reports alerts. */
  openAlerts?: number;
  children: ComponentChildren;
}

/** Side rail at desktop widths, a top bar under 820 px. */
export function Shell({ openAlerts, children }: ShellProps) {
  const { user, role, signOut } = useSession();
  const [path] = useLocation();
  const items = NAV.filter((item) => !item.adminOnly || role === 'admin');

  return (
    <div class="shell">
      <a class="skip-link" href="#main">
        Skip to content
      </a>
      <header class="rail">
        <span class="rail__brand">
          <IconGateway size={20} />
          gwfleet
        </span>
        <nav class="rail__nav" aria-label="Main">
          {items.map((item) => {
            const badge = item.href === '/alerts' && openAlerts !== undefined && openAlerts > 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                class="rail__link"
                aria-current={isActive(item.href, path) ? 'page' : undefined}
                aria-label={badge ? `${item.label}, ${openAlerts} open` : undefined}
              >
                {item.icon}
                <span>{item.label}</span>
                {badge && (
                  <span class="rail__count" aria-hidden="true">
                    {openAlerts}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div class="rail__user">
          <span class="rail__who">
            <span>{user?.name}</span>
            <span class="muted">{role ? ROLE_LABEL[role] : ''}</span>
          </span>
          <Button variant="ghost" size="sm" icon={<IconSignOut />} onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </header>
      <main id="main" class="shell__main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
