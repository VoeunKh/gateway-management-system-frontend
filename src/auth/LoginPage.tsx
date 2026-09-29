import type { JSX } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Redirect, useLocation, useSearch } from 'wouter-preact';
import { ApiError, NETWORK_ERROR_MESSAGE } from '@/api/errors';
import { Button, Field, IconGateway } from '@/ui';
import { useSession } from './session';

const LOCKED_MESSAGE =
  'This account is locked after too many failed sign-ins. Try again later or ask an admin.';

/** Only same-site paths, so ?next= can't send someone to another origin. */
export function safeNext(search: string): string {
  const next = new URLSearchParams(search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    return error.code === 'account_locked' ? LOCKED_MESSAGE : error.message;
  }
  return NETWORK_ERROR_MESSAGE;
}

export function LoginPage() {
  const { status, signIn } = useSession();
  const [, navigate] = useLocation();
  const next = safeNext(useSearch());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  // Before first paint, so keystrokes typed straight away land in the field.
  useLayoutEffect(() => emailRef.current?.focus(), []);

  if (status === 'authenticated' && !pending) return <Redirect to={next} replace />;

  const onSubmit = async (event: JSX.TargetedSubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = {
      email: email.trim() ? undefined : 'Enter your email.',
      password: password ? undefined : 'Enter your password.',
    };
    setFieldErrors(errors);
    setFormError(null);
    if (errors.email || errors.password) return;

    setPending(true);
    try {
      await signIn(email.trim(), password);
      navigate(next, { replace: true });
    } catch (error) {
      setFormError(messageFor(error));
      setPending(false);
    }
  };

  return (
    <main class="login">
      <form class="login__card" onSubmit={onSubmit} noValidate aria-labelledby="login-title">
        <span class="login__mark" aria-hidden="true">
          <IconGateway size={28} />
        </span>
        <h1 id="login-title">Sign in to gwfleet</h1>
        <Field
          inputRef={emailRef}
          label="Email"
          name="email"
          type="email"
          autoComplete="username"
          value={email}
          error={fieldErrors.email}
          onInput={(e) => setEmail(e.currentTarget.value)}
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          error={fieldErrors.password}
          onInput={(e) => setPassword(e.currentTarget.value)}
        />
        {formError && (
          <p class="login__error" role="alert">
            {formError}
          </p>
        )}
        <Button type="submit" variant="primary" loading={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </main>
  );
}
