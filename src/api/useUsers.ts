import { useQuery } from '@tanstack/react-query';
import { listUsers } from './endpoints';

/** Every user. Admin-only on the server, so callers pass `enabled` for other roles. */
export function useUsers(enabled = true) {
  return useQuery({ queryKey: ['users'], queryFn: listUsers, enabled, staleTime: 5 * 60_000 });
}
