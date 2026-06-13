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

export const adminCreateUserSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  email,
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  role: z.enum(['USER', 'ADMIN']).optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
});

export const adminUpdateUserSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    email: email.optional(),
    password: z.string().min(8).max(128).optional(),
    role: z.enum(['USER', 'ADMIN']).optional(),
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: 'No fields provided to update' });

export const deleteUserQuery = z.object({
  mode: z.enum(['soft', 'hard']).default('soft'),
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

// Profile photo: a small base64 image data URI, or null to remove it. Capped
// well under the 64KB request-body limit (the client resizes before upload).
export const updateAvatarSchema = z.object({
  avatar: z
    .string()
    .regex(/^data:image\/(jpeg|jpg|png|webp);base64,/, 'Must be an image data URL')
    .max(60000, 'Image too large — please pick a smaller photo')
    .nullable(),
});

// Encrypted message: base64 ciphertext + 24-byte NaCl box nonce.
export const sendMessageSchema = z.object({
  ciphertext: base64.max(8000, 'Ciphertext too large'),
  nonce: base64OfBytes(24, 'nonce'),
  // Optional id of the message this one quotes/replies to.
  replyToId: z.uuid().optional(),
});

// Editing replaces the encrypted body (client re-encrypts the new text).
export const editMessageSchema = z.object({
  ciphertext: base64.max(8000, 'Ciphertext too large'),
  nonce: base64OfBytes(24, 'nonce'),
});

// Toggling an emoji reaction. The emoji is short but may be multi-codepoint.
export const reactionSchema = z.object({
  emoji: z.string().min(1, 'emoji is required').max(16, 'emoji too long'),
});

// --- Calls ---

// Recorded by the caller's client when a 1:1 call ends. The server derives the
// callee from the conversation; media itself never touches the server.
export const createCallLogSchema = z.object({
  conversationId: z.uuid(),
  type: z.enum(['AUDIO', 'VIDEO']),
  status: z.enum(['ANSWERED', 'MISSED', 'REJECTED', 'CANCELED']),
  duration: z.coerce.number().int().min(0).max(60 * 60 * 24).default(0),
});

// --- Push notifications ---

// An Expo push token, e.g. ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx].
export const registerPushTokenSchema = z.object({
  token: z
    .string()
    .regex(/^Expo(nent)?PushToken\[[^\]]+\]$/, 'Must be a valid Expo push token'),
  platform: z.enum(['ios', 'android', 'web']).optional(),
});

export const unregisterPushTokenSchema = z.object({
  token: z.string().min(1, 'token is required'),
});
