// Typed HTTP client for the Dipanix API. Attaches the access token, and
// transparently refreshes it on a 401 (rotating refresh token), retrying once.
import { API_URL } from './config';
import {
  clearSession,
  getSession,
  setSession,
  type AccountStatus,
  type Role,
  type SessionUser,
} from './session';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface RequestOptions {
  auth?: boolean; // attach access token (default true)
  retry?: boolean; // allow one refresh+retry on 401 (default true)
}

// Single-flight guard: if several requests 401 at once, they must share one
// refresh. Refresh tokens are one-time (rotated on use) and the server treats a
// reused token as theft — revoking the whole chain. Without this, concurrent
// refreshes would each present the same old token and trip that detection,
// logging the user out spuriously.
let refreshInFlight: Promise<boolean> | null = null;

function refreshTokens(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function doRefresh(): Promise<boolean> {
  const session = getSession();
  if (!session) return false;
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
    if (!res.ok) {
      await clearSession();
      return false;
    }
    const data = (await res.json()) as { accessToken: string; refreshToken: string; user: SessionUser };
    await setSession(data);
    return true;
  } catch {
    return false;
  }
}

/** Reads a JWT's `exp` without verifying it (we just need the expiry locally). */
function isAccessTokenExpired(token: string): boolean {
  try {
    const part = token.split('.')[1];
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(
      decodeURIComponent(
        atob(b64)
          .split('')
          .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
          .join(''),
      ),
    ) as { exp?: number };
    if (typeof json.exp !== 'number') return true;
    return Date.now() >= json.exp * 1000 - 10_000; // refresh ~10s early
  } catch {
    return true; // unreadable token → treat as expired so we refresh
  }
}

/**
 * Ensures the stored session has a usable access token, refreshing it if it has
 * expired. Call on app startup so a returning user lands straight in the app
 * with a valid token (clean socket connect, no first-request 401). A network
 * error leaves the session intact; only a server-rejected refresh clears it.
 */
export async function ensureFreshSession(): Promise<void> {
  const session = getSession();
  if (!session) return;
  if (isAccessTokenExpired(session.accessToken)) {
    await refreshTokens();
  }
}

export async function apiRequest<T>(
  method: string,
  path: string,
  body?: unknown,
  opts: RequestOptions = {},
): Promise<T> {
  const auth = opts.auth ?? true;
  const retry = opts.retry ?? true;
  const session = getSession();

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth && session) headers.Authorization = `Bearer ${session.accessToken}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && auth && retry && getSession()) {
    const refreshed = await refreshTokens();
    if (refreshed) return apiRequest<T>(method, path, body, { auth, retry: false });
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

// --- Response types (mirror the backend) ---

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  status: AccountStatus;
  publicKey: string | null;
  avatar: string | null;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

export type Relationship =
  | { status: 'self' }
  | { status: 'none' }
  | { status: 'request_sent'; requestId: string }
  | { status: 'request_received'; requestId: string }
  | { status: 'connected'; conversationId: string };

export interface Reaction {
  userId: string;
  emoji: string;
}

/** The minimal shape of a quoted (reply-to) message, enough to decrypt a preview. */
export interface ReplyPreview {
  id: string;
  senderId: string;
  ciphertext: string;
  nonce: string;
  senderPublicKey: string;
  recipientPublicKey: string;
  deletedAt: string | null;
}

export interface EncryptedMessage {
  id: string;
  senderId: string;
  ciphertext: string;
  nonce: string;
  senderPublicKey: string;
  recipientPublicKey: string;
  readAt: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  replyToId: string | null;
  replyTo: ReplyPreview | null;
  reactions: Reaction[];
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  contact: PublicUser;
  lastMessage: EncryptedMessage | null;
  unreadCount: number;
  updatedAt: string;
  createdAt: string;
}

export interface MessageRequest {
  id: string;
  requesterId: string;
  recipientId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
  requester?: PublicUser;
  recipient?: PublicUser;
}

// --- Endpoint groups ---

export const authApi = {
  register: (body: { name: string; email: string; password: string }) =>
    apiRequest<{ message: string; user: SessionUser & { role: Role } }>(
      'POST',
      '/api/auth/register',
      body,
      { auth: false },
    ),
  login: (body: { email: string; password: string }) =>
    apiRequest<AuthResponse>('POST', '/api/auth/login', body, { auth: false }),
  logout: (refreshToken: string) =>
    apiRequest<void>('POST', '/api/auth/logout', { refreshToken }, { auth: false }),
  me: () => apiRequest<{ user: SessionUser }>('GET', '/api/auth/me'),
};

export const usersApi = {
  search: (email: string) =>
    apiRequest<{ user: PublicUser; relationship: Relationship }>(
      'GET',
      `/api/users/search?email=${encodeURIComponent(email)}`,
    ),
  uploadPublicKey: (publicKey: string) =>
    apiRequest<{ user: SessionUser }>('PUT', '/api/users/me/keys', { publicKey }),
  putBackup: (backup: string) =>
    apiRequest<{ ok: true }>('PUT', '/api/users/me/key-backup', { backup }),
  getBackup: () => apiRequest<{ backup: string | null }>('GET', '/api/users/me/key-backup'),
  updateAvatar: (avatar: string | null) =>
    apiRequest<{ user: SessionUser }>('PUT', '/api/users/me/avatar', { avatar }),
};

export type CallType = 'AUDIO' | 'VIDEO';
export type CallStatus = 'ANSWERED' | 'MISSED' | 'REJECTED' | 'CANCELED';

export interface CallLogEntry {
  id: string;
  conversationId: string;
  contact: PublicUser;
  type: CallType;
  status: CallStatus;
  direction: 'outgoing' | 'incoming';
  duration: number;
  createdAt: string;
}

export const callsApi = {
  list: () => apiRequest<{ calls: CallLogEntry[] }>('GET', '/api/calls'),
  log: (entry: {
    conversationId: string;
    type: CallType;
    status: CallStatus;
    duration: number;
  }) => apiRequest<{ call: { id: string } }>('POST', '/api/calls', entry),
};

export const notificationsApi = {
  register: (token: string, platform: string) =>
    apiRequest<{ ok: true }>('PUT', '/api/users/me/push-token', { token, platform }),
  unregister: (token: string) =>
    apiRequest<{ ok: true }>('DELETE', '/api/users/me/push-token', { token }),
};

export const requestsApi = {
  send: (recipientId: string) =>
    apiRequest<{ message: string }>('POST', '/api/requests', { recipientId }),
  incoming: () => apiRequest<{ requests: MessageRequest[] }>('GET', '/api/requests/incoming'),
  outgoing: () => apiRequest<{ requests: MessageRequest[] }>('GET', '/api/requests/outgoing'),
  accept: (id: string) =>
    apiRequest<{ conversation: { id: string } }>('POST', `/api/requests/${id}/accept`),
  reject: (id: string) => apiRequest<{ message: string }>('POST', `/api/requests/${id}/reject`),
};

export const conversationsApi = {
  list: () => apiRequest<{ conversations: ConversationSummary[] }>('GET', '/api/conversations'),
  messages: (id: string) =>
    apiRequest<{ messages: EncryptedMessage[] }>('GET', `/api/conversations/${id}/messages`),
  send: (id: string, ciphertext: string, nonce: string, replyToId?: string) =>
    apiRequest<{ message: EncryptedMessage }>(
      'POST',
      `/api/conversations/${id}/messages`,
      { ciphertext, nonce, replyToId },
    ),
  edit: (id: string, messageId: string, ciphertext: string, nonce: string) =>
    apiRequest<{ message: EncryptedMessage }>(
      'PATCH',
      `/api/conversations/${id}/messages/${messageId}`,
      { ciphertext, nonce },
    ),
  remove: (id: string, messageId: string) =>
    apiRequest<{ message: EncryptedMessage | null }>(
      'DELETE',
      `/api/conversations/${id}/messages/${messageId}`,
    ),
  react: (id: string, messageId: string, emoji: string) =>
    apiRequest<{ message: EncryptedMessage }>(
      'PUT',
      `/api/conversations/${id}/messages/${messageId}/reactions`,
      { emoji },
    ),
};
