import { useState } from 'preact/hooks';
import type { Schemas } from '@/api/endpoints';
import { useUsers } from '@/api/useUsers';
import { useSession } from '@/auth/session';
import { Button, Dialog, EmptyState, ErrorState, Skeleton } from '@/ui';
import { AddUserDialog } from './AddUserDialog';
import { UsersTable } from './UsersTable';
import { useUserMutations } from './useUserMutations';

type User = Schemas['User'];

function DeleteUserDialog({ user, onClose }: { user: User | null; onClose: () => void }) {
  const { remove } = useUserMutations();
  return (
    <Dialog
      open={user !== null}
      onClose={onClose}
      title={`Delete ${user?.name ?? 'user'}?`}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            loading={remove.isPending}
            onClick={() => {
              if (!user) return;
              remove.mutate(user, { onSuccess: onClose });
            }}
          >
            Delete
          </Button>
        </>
      }
    >
      <p>
        {user?.email} will no longer be able to sign in. This can't be undone; to give them access
        again, add them as a new user.
      </p>
    </Dialog>
  );
}

/** Admin only: the route is wrapped in <RequireRole min="admin">. */
export function UsersPage() {
  const users = useUsers();
  const { user: me } = useSession();
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<User | null>(null);

  let body;
  if (users.isPending) body = <Skeleton lines={5} label="Loading users" />;
  else if (users.isError)
    body = <ErrorState message={users.error.message} onRetry={() => void users.refetch()} />;
  else if (users.data.length === 0)
    body = <EmptyState title="No users yet">Add the first person who needs access.</EmptyState>;
  else body = <UsersTable users={users.data} currentUserId={me?.id} onDelete={setDeleting} />;

  return (
    <section class="page">
      <header class="config-head">
        <h1>Users</h1>
        <Button variant="primary" onClick={() => setAdding(true)}>
          Add user
        </Button>
      </header>
      {body}
      <AddUserDialog open={adding} onClose={() => setAdding(false)} />
      <DeleteUserDialog user={deleting} onClose={() => setDeleting(null)} />
    </section>
  );
}
