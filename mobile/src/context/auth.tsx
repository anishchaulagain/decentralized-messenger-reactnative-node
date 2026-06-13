import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { authApi } from '@/lib/api';
import {
  clearSession,
  getSession,
  loadSession,
  setSession,
  subscribe,
  type Session,
} from '@/lib/session';
import {
  registerForPushNotifications,
  unregisterPushNotifications,
} from '@/lib/notifications';
import { connectSocket, disconnectSocket } from '@/lib/socket';

interface AuthContextValue {
  session: Session | null;
  ready: boolean; // initial load from storage finished
  signIn: (email: string, password: string) => Promise<Session>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadSession().then((s) => {
      setSessionState(s);
      setReady(true);
    });
    return subscribe(setSessionState);
  }, []);

  // Keep the realtime socket connected whenever there's a session.
  useEffect(() => {
    if (session) connectSocket();
    else disconnectSocket();
  }, [session]);

  // Register this device for push notifications when a user signs in. Keyed on
  // the user id so it doesn't re-run on every token refresh.
  useEffect(() => {
    if (session) void registerForPushNotifications();
    // Intentionally keyed on the user id only — re-running on every token
    // refresh would re-register needlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      ready,
      async signIn(email, password) {
        const res = await authApi.login({ email, password });
        // Admins do not use the mobile app — they have a separate console.
        if (res.user.role === 'ADMIN') {
          throw new Error('Admin accounts must sign in from the admin console.');
        }
        await setSession(res);
        return res;
      },
      async signOut() {
        const s = getSession();
        if (s) {
          // Stop this device from receiving the signed-out user's pushes, then
          // best-effort revoke. Clear locally regardless.
          await unregisterPushNotifications();
          await authApi.logout(s.refreshToken).catch(() => undefined);
        }
        await clearSession();
      },
    }),
    [session, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
