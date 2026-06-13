import { Router } from 'express';
import type { Prisma } from '@prisma/client';

import { ApiError, asyncHandler } from '../lib/http-error';
import { hashPassword } from '../lib/password';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  adminCreateUserSchema,
  adminUpdateUserSchema,
  adminUserListQuery,
  deleteUserQuery,
} from '../schemas';

type Role = 'USER' | 'ADMIN';
type AccountStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

const router = Router();

router.use(authenticate, requireAdmin);

// List users, optionally filtered by status or a name/email search.
router.get(
  '/users',
  validateQuery(adminUserListQuery),
  asyncHandler(async (_req, res) => {
    const { status, search } = res.locals.query as {
      status?: 'PENDING' | 'APPROVED' | 'REJECTED';
      search?: string;
    };

    const where: Prisma.UserWhereInput = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      omit: { passwordHash: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ users });
  }),
);

async function moderate(userId: string, adminId: string, status: 'APPROVED' | 'REJECTED') {
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw new ApiError(404, 'User not found');
  if (target.role === 'ADMIN') throw new ApiError(400, 'Admin accounts cannot be moderated');

  return prisma.user.update({
    where: { id: userId },
    data: { status, reviewedAt: new Date(), reviewedById: adminId },
    omit: { passwordHash: true },
  });
}

// Approve a pending (or previously rejected) account.
router.post(
  '/users/:id/approve',
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const user = await moderate(id, req.user!.id, 'APPROVED');
    res.json({ message: 'User approved', user });
  }),
);

// Reject an account.
router.post(
  '/users/:id/reject',
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const user = await moderate(id, req.user!.id, 'REJECTED');
    res.json({ message: 'User rejected', user });
  }),
);

// Create a user directly (defaults to an approved USER). Email must be unique.
router.post(
  '/users',
  validateBody(adminCreateUserSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password, role, status } = req.body as {
      name: string;
      email: string;
      password: string;
      role?: Role;
      status?: AccountStatus;
    };

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new ApiError(409, 'An account with this email already exists');

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(password),
        role: role ?? 'USER',
        status: status ?? 'APPROVED',
        reviewedAt: new Date(),
        reviewedById: req.user!.id,
      },
      omit: { passwordHash: true },
    });
    res.status(201).json({ message: 'User created', user });
  }),
);

// Update a user's profile / role / status / password (any subset).
router.patch(
  '/users/:id',
  validateBody(adminUpdateUserSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) throw new ApiError(404, 'User not found');

    const { name, email, password, role, status } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      role?: Role;
      status?: AccountStatus;
    };

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (role !== undefined) data.role = role;
    if (password !== undefined) data.passwordHash = await hashPassword(password);
    if (status !== undefined) {
      data.status = status;
      data.reviewedAt = new Date();
      data.reviewedById = req.user!.id;
    }

    const user = await prisma.user.update({ where: { id }, data, omit: { passwordHash: true } });
    res.json({ message: 'User updated', user });
  }),
);

// Delete a user. ?mode=soft (default) deactivates and retains the row; ?mode=hard
// permanently removes the user and cascades to their messages/requests/conversations.
router.delete(
  '/users/:id',
  validateQuery(deleteUserQuery),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const { mode } = res.locals.query as { mode: 'soft' | 'hard' };

    if (id === req.user!.id) {
      throw new ApiError(400, 'You cannot delete your own account');
    }
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) throw new ApiError(404, 'User not found');

    if (mode === 'hard') {
      await prisma.user.delete({ where: { id } });
      return res.json({ message: 'User permanently deleted', mode });
    }

    // Soft delete: mark deactivated and revoke active refresh tokens.
    const [user] = await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: { deletedAt: new Date() },
        omit: { passwordHash: true },
      }),
      prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    res.json({ message: 'User deactivated', mode, user });
  }),
);

// Restore a soft-deleted user.
router.post(
  '/users/:id/restore',
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) throw new ApiError(404, 'User not found');

    const user = await prisma.user.update({
      where: { id },
      data: { deletedAt: null },
      omit: { passwordHash: true },
    });
    res.json({ message: 'User restored', user });
  }),
);

export default router;
