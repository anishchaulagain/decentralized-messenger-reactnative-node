// Persisted auth session (tokens + user), kept in the OS secure store and
// mirrored in memory with a simple subscription so React can react to changes.
import * as SecureStore from 'expo-secure-store';

export type Role = 'USER' | 'ADMIN';
export type AccountStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: AccountStatus;
  publicKey: string | null;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

const STORE_KEY = 'dipanix.session';

let current: Session | null = null;
const listeners = new Set<(s: Session | null) => void>();

function emit() {
  for (const fn of listeners) fn(current);
}

export function subscribe(fn: (s: Session | null) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getSession(): Session | null {
  return current;
}

/** Loads the persisted session into memory (call once at startup). */
export async function loadSession(): Promise<Session | null> {
  const raw = await SecureStore.getItemAsync(STORE_KEY);
  current = raw ? (JSON.parse(raw) as Session) : null;
  return current;
}

export async function setSession(session: Session): Promise<void> {
  current = session;
  await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(session));
  emit();
}

/** Updates just the user portion (e.g. after uploading a public key). */
export async function patchUser(patch: Partial<SessionUser>): Promise<void> {
  if (!current) return;
  current = { ...current, user: { ...current.user, ...patch } };
  await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(current));
  emit();
}

export async function clearSession(): Promise<void> {
  current = null;
  await SecureStore.deleteItemAsync(STORE_KEY);
  emit();
}
