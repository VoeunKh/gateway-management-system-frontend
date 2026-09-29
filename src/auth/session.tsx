import { useQueryClient } from '@tanstack/react-query';
import type { ComponentChildren } from 'preact';
import { createContext } from 'preact';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { getMe, login, logout } from '@/api/endpoints';
import type { Schemas } from '@/api/endpoints';
import { SESSION_EXPIRED, authEvents, getAccessToken, setAccessToken } from '@/api/token';
import type { Role } from './permissions';

type User = Schemas['User'];
export type SessionStatus = 'loading' | 'authenticated' | 'anonymous';

export interface Session {
  status: SessionStatus;
  user: User | null;
  role: Role | null;
  token: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside <SessionProvider>');
  return session;
}

/**
 * Holds the signed-in user. On load it asks GET /auth/me; the client refreshes from the
 * HttpOnly cookie if needed, so a reload keeps the session. A failed refresh anywhere
 * (session-expired) signs the user out.
 */
export function SessionProvider({ children }: { children: ComponentChildren }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  // Set once the user signs in or out, so a slow startup check can't undo it.
  const settled = useRef(false);

  const clear = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus('anonymous');
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    let active = true;
    const current = () => active && !settled.current;
    getMe()
      .then((me) => {
        if (!current()) return;
        setUser(me);
        setStatus('authenticated');
      })
      .catch(() => {
        if (current()) setStatus('anonymous');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    authEvents.addEventListener(SESSION_EXPIRED, clear);
    return () => authEvents.removeEventListener(SESSION_EXPIRED, clear);
  }, [clear]);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await login({ email, password });
    settled.current = true;
    setAccessToken(result.access_token);
    setUser(result.user);
    setStatus('authenticated');
  }, []);

  const signOut = useCallback(async () => {
    settled.current = true;
    await logout().catch(() => undefined);
    clear();
  }, [clear]);

  const value = useMemo<Session>(
    () => ({
      status,
      user,
      role: user?.role ?? null,
      token: status === 'authenticated' ? getAccessToken() : null,
      signIn,
      signOut,
    }),
    [status, user, signIn, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
