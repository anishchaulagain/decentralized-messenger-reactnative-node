import { z } from 'zod';

const email = z
  .email('A valid email is required')
  .transform((value) => value.trim().toLowerCase());

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  email,
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
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

export const sendMessageSchema = z.object({
  body: z.string().trim().min(1, 'Message cannot be empty').max(4000),
});
