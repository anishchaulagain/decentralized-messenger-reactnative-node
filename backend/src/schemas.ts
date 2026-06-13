import { z } from 'zod';

const email = z
  .email('A valid email is required')
  .transform((value) => value.trim().toLowerCase());

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  email,
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken is required'),
});

export const adminUserListQuery = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  search: z.string().trim().optional(),
});

export const userSearchQuery = z.object({
  email,
});

export const createRequestSchema = z.object({
  recipientId: z.uuid('A valid recipientId is required'),
});

// --- End-to-end encryption ---

const base64 = z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/, 'Must be base64');

/** A base64 value that decodes to exactly `bytes` bytes. */
function base64OfBytes(bytes: number, label: string) {
  return base64.refine((s) => Buffer.from(s, 'base64').length === bytes, {
    message: `${label} must be ${bytes} bytes`,
  });
}

// X25519 public key = 32 bytes.
export const publicKeySchema = base64OfBytes(32, 'publicKey');

export const updatePublicKeySchema = z.object({
  publicKey: publicKeySchema,
});

// Opaque passphrase-encrypted private-key backup (a JSON blob the server can't read).
export const keyBackupSchema = z.object({
  backup: z.string().min(1).max(20000),
});

// Encrypted message: base64 ciphertext + 24-byte NaCl box nonce.
export const sendMessageSchema = z.object({
  ciphertext: base64.max(8000, 'Ciphertext too large'),
  nonce: base64OfBytes(24, 'nonce'),
});
