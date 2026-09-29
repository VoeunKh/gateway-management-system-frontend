import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createUser, deleteUser, updateUser } from '@/api/endpoints';
import type { Schemas } from '@/api/endpoints';
import { ROLE_LABEL } from '@/auth/permissions';
import { useToast } from '@/ui';

type User = Schemas['User'];

/**
 * Add, re-role and delete users. Each refreshes the shared ['users'] list. The toasts live
 * in the hook's own options, which always run, rather than in per-call mutate() callbacks,
 * which TanStack skips if the component isn't subscribed yet.
 */
export function useUserMutations() {
  const client = useQueryClient();
  const toast = useToast();
  const refresh = () => client.invalidateQueries({ queryKey: ['users'] });
  return {
    create: useMutation({
      mutationFn: (body: Schemas['CreateUserRequest']) => createUser(body),
      onSuccess: (user) => {
        toast({ message: `Added ${user.name} as ${ROLE_LABEL[user.role]}`, tone: 'ok' });
        return refresh();
      },
    }),
    setRole: useMutation({
      mutationFn: ({ user, role }: { user: User; role: User['role'] }) =>
        updateUser(user.id, { role }),
      onSuccess: (user) => {
        toast({ message: `${user.name} is now ${ROLE_LABEL[user.role]}`, tone: 'ok' });
        return refresh();
      },
      onError: (error) => toast({ message: `Role not changed: ${error.message}`, tone: 'danger' }),
    }),
    remove: useMutation({
      mutationFn: (user: User) => deleteUser(user.id),
      onSuccess: (_, user) => {
        toast({ message: `Deleted ${user.name}`, tone: 'ok' });
        return refresh();
      },
      onError: (error) => toast({ message: `Not deleted: ${error.message}`, tone: 'danger' }),
    }),
  };
}
