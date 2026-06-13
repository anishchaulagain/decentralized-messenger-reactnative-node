import { Router } from 'express';
import type { Prisma } from '@prisma/client';

import { ApiError, asyncHandler } from '../lib/http-error';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';
import { validateQuery } from '../middleware/validate';
import { adminUserListQuery } from '../schemas';

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

export default router;
