import { Router } from 'express';

import { orderedPair } from '../lib/contacts';
import { ApiError, asyncHandler } from '../lib/http-error';
import { prisma } from '../lib/prisma';
import { toPublicUser } from '../lib/serializers';
import { authenticate, requireApproved } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { createRequestSchema } from '../schemas';

const router = Router();

router.use(authenticate, requireApproved);

// Send a message request to another approved user.
router.post(
  '/',
  validateBody(createRequestSchema),
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const { recipientId } = req.body as { recipientId: string };

    if (recipientId === me) {
      throw new ApiError(400, 'You cannot send a request to yourself');
    }

    const recipient = await prisma.user.findUnique({ where: { id: recipientId } });
    if (!recipient || recipient.status !== 'APPROVED') {
      throw new ApiError(404, 'Recipient not found');
    }

    const [mine, reverse] = await Promise.all([
      prisma.messageRequest.findUnique({
        where: { requesterId_recipientId: { requesterId: me, recipientId } },
      }),
      prisma.messageRequest.findUnique({
        where: { requesterId_recipientId: { requesterId: recipientId, recipientId: me } },
      }),
    ]);

    if (reverse?.status === 'PENDING') {
      throw new ApiError(409, 'This user already sent you a request — accept it instead');
    }
    if (reverse?.status === 'ACCEPTED' || mine?.status === 'ACCEPTED') {
      throw new ApiError(409, 'You are already connected with this user');
    }
    if (mine?.status === 'PENDING') {
      throw new ApiError(409, 'You already have a pending request with this user');
    }

    // Re-open a previously rejected request, or create a fresh one.
    const request = mine
      ? await prisma.messageRequest.update({
          where: { id: mine.id },
          data: { status: 'PENDING' },
        })
      : await prisma.messageRequest.create({ data: { requesterId: me, recipientId } });

    res.status(201).json({
      message: 'Message request sent',
      request: { ...request, recipient: toPublicUser(recipient) },
    });
  }),
);

// Requests other users have sent to me, awaiting my response.
router.get(
  '/incoming',
  asyncHandler(async (req, res) => {
    const requests = await prisma.messageRequest.findMany({
      where: { recipientId: req.user!.id, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: {
        requester: { select: { id: true, name: true, email: true, status: true } },
      },
    });
    res.json({ requests });
  }),
);

// Requests I have sent.
router.get(
  '/outgoing',
  asyncHandler(async (req, res) => {
    const requests = await prisma.messageRequest.findMany({
      where: { requesterId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      include: {
        recipient: { select: { id: true, name: true, email: true, status: true } },
      },
    });
    res.json({ requests });
  }),
);

/** Loads a pending request that the current user is the recipient of. */
async function loadPendingForRecipient(requestId: string, recipientId: string) {
  const request = await prisma.messageRequest.findUnique({ where: { id: requestId } });
  if (!request || request.recipientId !== recipientId) {
    throw new ApiError(404, 'Request not found');
  }
  if (request.status !== 'PENDING') {
    throw new ApiError(409, 'This request has already been answered');
  }
  return request;
}

// Accept a request — marks it accepted and opens a conversation.
router.post(
  '/:id/accept',
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const { id } = req.params as { id: string };
    const request = await loadPendingForRecipient(id, me);
    const [userAId, userBId] = orderedPair(request.requesterId, request.recipientId);

    const conversation = await prisma.$transaction(async (tx) => {
      await tx.messageRequest.update({
        where: { id: request.id },
        data: { status: 'ACCEPTED' },
      });
      return tx.conversation.upsert({
        where: { userAId_userBId: { userAId, userBId } },
        update: {},
        create: { userAId, userBId },
      });
    });

    res.json({ message: 'Request accepted', conversation });
  }),
);

// Reject a request.
router.post(
  '/:id/reject',
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const { id } = req.params as { id: string };
    const request = await loadPendingForRecipient(id, me);
    const updated = await prisma.messageRequest.update({
      where: { id: request.id },
      data: { status: 'REJECTED' },
    });
    res.json({ message: 'Request rejected', request: updated });
  }),
);

export default router;
