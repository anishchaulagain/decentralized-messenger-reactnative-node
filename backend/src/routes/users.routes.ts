import { Router } from 'express';

import { getRelationship } from '../lib/contacts';
import { ApiError, asyncHandler } from '../lib/http-error';
import { prisma } from '../lib/prisma';
import { toPublicUser } from '../lib/serializers';
import { authenticate, requireApproved } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validate';
import { updatePublicKeySchema, userSearchQuery } from '../schemas';

const router = Router();

router.use(authenticate, requireApproved);

// Register/replace the caller's E2EE public key. The private key stays on the
// device; the server only ever stores this public half.
router.put(
  '/me/keys',
  validateBody(updatePublicKeySchema),
  asyncHandler(async (req, res) => {
    const { publicKey } = req.body as { publicKey: string };
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { publicKey },
      omit: { passwordHash: true },
    });
    res.json({ user });
  }),
);

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
