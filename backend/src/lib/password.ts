import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// A throwaway hash to compare against when the account doesn't exist, so login
// takes the same time whether or not the email is registered (defeats user
// enumeration via response timing).
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync('dummy-password-not-used', SALT_ROUNDS);
