import { Router } from 'express';

import { orderedPair } from '../lib/contacts';
import { ApiError, asyncHandler } from '../lib/http-error';
import { prisma } from '../lib/prisma';
import { sendPushToUser } from '../lib/push';
import { emitToUsers, isUserOnline } from '../lib/realtime';
import { publicUserSelect, toPublicUser } from '../lib/serializers';
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

    // Notify the recipient in real time (and via push if they're offline) so a
    // new request surfaces immediately instead of only on screen refocus.
    const requestForRecipient = { ...request, requester: toPublicUser(req.user!) };
    emitToUsers([recipientId], 'request:new', { request: requestForRecipient });
    if (!isUserOnline(recipientId)) {
      void sendPushToUser(recipientId, {
        title: req.user!.name,
        body: 'sent you a message request',
        data: { type: 'request' },
      });
    }

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
        requester: { select: publicUserSelect },
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
        recipient: { select: publicUserSelect },
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

    // Batch (single round trip) — more robust over a high-latency cloud DB than
    // an interactive transaction held open across awaits.
    const [, conversation] = await prisma.$transaction([
      prisma.messageRequest.update({
        where: { id: request.id },
        data: { status: 'ACCEPTED' },
      }),
      prisma.conversation.upsert({
        where: { userAId_userBId: { userAId, userBId } },
        update: {},
        create: { userAId, userBId },
      }),
    ]);

    // Let the original requester know their request was accepted so their UI can
    // jump into the new conversation live (push if they're offline).
    emitToUsers([request.requesterId], 'request:accepted', {
      conversationId: conversation.id,
    });
    if (!isUserOnline(request.requesterId)) {
      void sendPushToUser(request.requesterId, {
        title: req.user!.name,
        body: 'accepted your message request',
        data: { type: 'request_accepted', conversationId: conversation.id },
      });
    }

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
