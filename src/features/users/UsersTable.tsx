import type { Schemas } from '@/api/endpoints';
import { ROLE_LABEL } from '@/auth/permissions';
import { Badge, Button, Table } from '@/ui';
import { ROLES } from './AddUserDialog';
import { useUserMutations } from './useUserMutations';

type User = Schemas['User'];

const SELF_ROLE = "You can't change your own role";
const SELF_DELETE = "You can't delete your own account";

function RoleSelect({ user, isSelf }: { user: User; isSelf: boolean }) {
  const { setRole } = useUserMutations();
  return (
    <select
      class="inline-select"
      aria-label={`Role for ${user.name}`}
      value={user.role}
      disabled={isSelf || setRole.isPending}
      title={isSelf ? SELF_ROLE : undefined}
      onChange={(event) => {
        const role = ROLES.find((r) => r === event.currentTarget.value);
        if (!role || role === user.role) return;
        setRole.mutate({ user, role });
      }}
    >
      {ROLES.map((role) => (
        <option key={role} value={role}>
          {ROLE_LABEL[role]}
        </option>
      ))}
    </select>
  );
}

export interface UsersTableProps {
  users: User[];
  currentUserId: string | undefined;
  onDelete: (user: User) => void;
}

export function UsersTable({ users, currentUserId, onDelete }: UsersTableProps) {
  return (
    <Table
      caption="Users"
      hideCaption
      rows={users}
      rowKey={(u) => u.id}
      columns={[
        {
          key: 'name',
          header: 'Name',
          cell: (u) => (
            <span class="cell-inline">
              {u.name}
              {u.id === currentUserId && <Badge tone="info">You</Badge>}
            </span>
          ),
        },
        { key: 'email', header: 'Email', cell: (u) => u.email },
        {
          key: 'role',
          header: 'Role',
          cell: (u) => <RoleSelect user={u} isSelf={u.id === currentUserId} />,
        },
        {
          key: 'actions',
          header: 'Actions',
          cell: (u) => (
            <Button
              size="sm"
              variant="danger"
              aria-label={`Delete ${u.name}`}
              disabled={u.id === currentUserId}
              title={u.id === currentUserId ? SELF_DELETE : undefined}
              onClick={() => onDelete(u)}
            >
              Delete
            </Button>
          ),
        },
      ]}
    />
  );
}
