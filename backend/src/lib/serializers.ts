import type { User } from '@prisma/client';

/** A user object safe to return over the API (never includes the password hash). */
export type SafeUser = Omit<User, 'passwordHash'>;

/** Minimal public shape exposed to other users (search results, requests, etc.). */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  status: User['status'];
  publicKey: string | null;
}

export function toPublicUser(
  user: Pick<User, 'id' | 'name' | 'email' | 'status' | 'publicKey'>,
): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    publicKey: user.publicKey,
  };
}

/** Public-user fields to select on related-user queries. */
export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  status: true,
  publicKey: true,
} as const;
