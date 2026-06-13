import { Router } from 'express';

import { ApiError, asyncHandler } from '../lib/http-error';
import { prisma } from '../lib/prisma';
import { publicUserSelect, toPublicUser } from '../lib/serializers';
import { authenticate, requireApproved } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { createCallLogSchema } from '../schemas';

const router = Router();

router.use(authenticate, requireApproved);

/** Loads a conversation and asserts the current user is a participant. */
async function loadParticipantConversation(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw new ApiError(404, 'Conversation not found');
  if (conversation.userAId !== userId && conversation.userBId !== userId) {
    throw new ApiError(403, 'You are not a participant in this conversation');
  }
  return conversation;
}

// My call history (as caller or callee), most recent first, with the other party.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const calls = await prisma.callLog.findMany({
      where: { OR: [{ callerId: me }, { calleeId: me }] },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        caller: { select: publicUserSelect },
        callee: { select: publicUserSelect },
      },
    });

    const result = calls.map((c) => {
      const outgoing = c.callerId === me;
      const other = outgoing ? c.callee : c.caller;
      return {
        id: c.id,
        conversationId: c.conversationId,
        contact: toPublicUser(other),
        type: c.type,
        status: c.status,
        direction: outgoing ? 'outgoing' : 'incoming',
        duration: c.duration,
        createdAt: c.createdAt,
      };
    });

    res.json({ calls: result });
  }),
);

// Record a finished call. Called by the caller's client; the callee is derived
// from the conversation so the same row serves both participants' histories.
router.post(
  '/',
  validateBody(createCallLogSchema),
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const { conversationId, type, status, duration } = req.body as {
      conversationId: string;
      type: 'AUDIO' | 'VIDEO';
      status: 'ANSWERED' | 'MISSED' | 'REJECTED' | 'CANCELED';
      duration: number;
    };

    const conversation = await loadParticipantConversation(conversationId, me);
    const calleeId =
      conversation.userAId === me ? conversation.userBId : conversation.userAId;

    const call = await prisma.callLog.create({
      data: { conversationId, callerId: me, calleeId, type, status, duration },
    });

    res.status(201).json({ call });
  }),
);

export default router;
