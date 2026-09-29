import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { ApiError } from '@/api/errors';
import type { Schemas } from '@/api/endpoints';
import { ROLE_LABEL } from '@/auth/permissions';
import type { Role } from '@/auth/permissions';
import { Badge, Button, Dialog, Field, SelectField } from '@/ui';
import { passwordStrength } from './passwordStrength';
import { useUserMutations } from './useUserMutations';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const ROLES: Role[] = ['viewer', 'release', 'admin'];

type Errors = Partial<Record<'name' | 'email' | 'password' | 'form', string>>;

export function validateNewUser(body: Schemas['CreateUserRequest']): Errors {
  const errors: Errors = {};
  if (!body.name.trim()) errors.name = 'Enter a name.';
  if (!body.email.trim()) errors.email = 'Enter an email address.';
  else if (!EMAIL.test(body.email.trim()))
    errors.email = 'Enter a valid email address, like name@example.com.';
  if (!body.password) errors.password = 'Enter a password.';
  return errors;
}

export function AddUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { create } = useUserMutations();
  const [form, setForm] = useState<Schemas['CreateUserRequest']>({
    name: '',
    email: '',
    role: 'viewer',
    password: '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const strength = passwordStrength(form.password);
  const set = (patch: Partial<Schemas['CreateUserRequest']>) => setForm({ ...form, ...patch });

  const close = () => {
    // Nothing typed here, the password least of all, outlives the dialog.
    setForm({ name: '', email: '', role: 'viewer', password: '' });
    setErrors({});
    onClose();
  };

  const submit = (event: JSX.TargetedSubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = validateNewUser(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    const body = { ...form, name: form.name.trim(), email: form.email.trim() };
    create.mutate(body, {
      onSuccess: close,
      onError: (error) =>
        setErrors(
          error instanceof ApiError && error.status === 409
            ? { email: 'A user with this email already exists.' }
            : { form: error.message },
        ),
    });
  };

  return (
    <Dialog open={open} onClose={close} title="Add user">
      <form class="user-form" onSubmit={submit} noValidate>
        <Field
          label="Name"
          value={form.name}
          error={errors.name}
          autoComplete="off"
          onInput={(e) => set({ name: e.currentTarget.value })}
        />
        <Field
          label="Email"
          type="email"
          value={form.email}
          error={errors.email}
          autoComplete="off"
          onInput={(e) => set({ email: e.currentTarget.value })}
        />
        <SelectField
          label="Role"
          value={form.role}
          options={ROLES.map((role) => ({ value: role, label: ROLE_LABEL[role] }))}
          onChange={(value) => set({ role: ROLES.find((role) => role === value) ?? 'viewer' })}
        />
        <Field
          label="Password"
          type="password"
          value={form.password}
          error={errors.password}
          hint="Give it to them securely; it isn't shown again."
          autoComplete="new-password"
          onInput={(e) => set({ password: e.currentTarget.value })}
        />
        <p class="user-form__strength" aria-live="polite">
          {strength && (
            <>
              Strength: <Badge tone={strength.tone}>{strength.label}</Badge>
            </>
          )}
        </p>
        {errors.form && (
          <p class="login__error" role="alert">
            {errors.form}
          </p>
        )}
        <div class="dialog__actions">
          <Button onClick={close}>Cancel</Button>
          <Button type="submit" variant="primary" loading={create.isPending}>
            Add user
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
