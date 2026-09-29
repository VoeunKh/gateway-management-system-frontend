import type { Schemas } from '@/api/endpoints';

// The UI mirrors these rules so controls can explain themselves; the server enforces them.
export type Role = Schemas['User']['role'];

const RANK: Record<Role, number> = { viewer: 0, release: 1, admin: 2 };

export const ROLE_LABEL: Record<Role, string> = {
  viewer: 'Viewer',
  release: 'Release engineer',
  admin: 'Admin',
};

/** Lowest role allowed each guarded action. */
export const PERMISSIONS = {
  config: 'release',
  firmware: 'release',
  rollout: 'release',
  action: 'admin',
  ackAlert: 'admin',
  editDevice: 'admin',
  users: 'admin',
} as const satisfies Record<string, Role>;

export type Permission = keyof typeof PERMISSIONS;

export function hasRole(role: Role | null, min: Role): boolean {
  return role !== null && RANK[role] >= RANK[min];
}

export function can(role: Role | null, perm: Permission): boolean {
  return hasRole(role, PERMISSIONS[perm]);
}

export function deniedMessage(role: Role | null): string {
  return `Your role (${role ? ROLE_LABEL[role] : 'Signed out'}) can't do this`;
}
