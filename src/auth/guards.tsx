import type { ComponentChildren, VNode } from 'preact';
import { cloneElement } from 'preact';
import { useEffect } from 'preact/hooks';
import { useLocation } from 'wouter-preact';
import { useToast } from '@/ui';
import { ROLE_LABEL, can, deniedMessage, hasRole } from './permissions';
import type { Permission, Role } from './permissions';
import { useSession } from './session';

function Denied({ role, area }: { role: Role | null; area: string }) {
  const [, navigate] = useLocation();
  const toast = useToast();
  useEffect(() => {
    const label = role ? ROLE_LABEL[role] : 'Signed out';
    toast({ message: `Your role (${label}) can't open ${area}.`, tone: 'info' });
    navigate('/', { replace: true });
  }, [area, navigate, role, toast]);
  return null;
}

export interface RequireRoleProps {
  min: Role;
  /** Named in the toast, e.g. "Users". */
  area: string;
  children: ComponentChildren;
}

/** Route guard: below `min`, redirect home with a toast saying why. */
export function RequireRole({ min, area, children }: RequireRoleProps) {
  const { role } = useSession();
  if (!hasRole(role, min)) return <Denied role={role} area={area} />;
  return <>{children}</>;
}

export interface CanProps {
  perm: Permission;
  /** One control, e.g. a Button. It is disabled with the reason as its tooltip, never hidden. */
  children: VNode<{ disabled?: boolean; title?: string }>;
}

export function Can({ perm, children }: CanProps) {
  const { role } = useSession();
  if (can(role, perm)) return children;
  return cloneElement(children, { disabled: true, title: deniedMessage(role) });
}
