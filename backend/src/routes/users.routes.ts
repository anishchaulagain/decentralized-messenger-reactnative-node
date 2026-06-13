import { Router } from 'express';

import { getRelationship } from '../lib/contacts';
import { ApiError, asyncHandler } from '../lib/http-error';
import { prisma } from '../lib/prisma';
import { toPublicUser } from '../lib/serializers';
import { authenticate, requireApproved } from '../middleware/auth';
import { validateQuery } from '../middleware/validate';
import { userSearchQuery } from '../schemas';

const router = Router();

router.use(authenticate, requireApproved);

// Find an approved user by exact email so a message request can be sent.
router.get(
  '/search',
  validateQuery(userSearchQuery),
  asyncHandler(async (req, res) => {
    const { email } = res.locals.query as { email: string };

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== 'APPROVED') {
      throw new ApiError(404, 'No user found with that email');
    }

    const relationship = await getRelationship(req.user!.id, user.id);
    res.json({ user: toPublicUser(user), relationship });
  }),
);

export default router;
