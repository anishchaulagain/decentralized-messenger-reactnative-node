import { Router } from 'express';

import { ApiError, asyncHandler } from '../lib/http-error';
import { prisma } from '../lib/prisma';
import { toPublicUser } from '../lib/serializers';
import { authenticate, requireApproved } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { sendMessageSchema } from '../schemas';

const router = Router();

router.use(authenticate, requireApproved);

const participantSelect = { select: { id: true, name: true, email: true, status: true } };

/** Loads a conversation and asserts the current user is a participant. */
async function loadParticipantConversation(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw new ApiError(404, 'Conversation not found');
  if (conversation.userAId !== userId && conversation.userBId !== userId) {
    throw new ApiError(403, 'You are not a participant in this conversation');
  }
  return conversation;
}

// List my conversations with the other participant, last message, and unread count.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const me = req.user!.id;

    const conversations = await prisma.conversation.findMany({
      where: { OR: [{ userAId: me }, { userBId: me }] },
      orderBy: { updatedAt: 'desc' },
      include: {
        userA: participantSelect,
        userB: participantSelect,
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    const unreadGroups = await prisma.message.groupBy({
      by: ['conversationId'],
      where: {
        conversation: { OR: [{ userAId: me }, { userBId: me }] },
        senderId: { not: me },
        readAt: null,
      },
      _count: { _all: true },
    });
    const unreadByConversation = new Map(
      unreadGroups.map((g) => [g.conversationId, g._count._all]),
    );

    const result = conversations.map((c) => {
      const other = c.userAId === me ? c.userB : c.userA;
      return {
        id: c.id,
        contact: toPublicUser(other),
        lastMessage: c.messages[0] ?? null,
        unreadCount: unreadByConversation.get(c.id) ?? 0,
        updatedAt: c.updatedAt,
        createdAt: c.createdAt,
      };
    });

    res.json({ conversations: result });
  }),
);

// Fetch messages for a conversation (oldest first) and mark incoming ones read.
router.get(
  '/:id/messages',
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const { id } = req.params as { id: string };
    await loadParticipantConversation(id, me);

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
    });

    await prisma.message.updateMany({
      where: { conversationId: id, senderId: { not: me }, readAt: null },
      data: { readAt: new Date() },
    });

    res.json({ messages });
  }),
);

// Send a message into a conversation.
router.post(
  '/:id/messages',
  validateBody(sendMessageSchema),
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const { id } = req.params as { id: string };
    await loadParticipantConversation(id, me);
    const { body } = req.body as { body: string };

    const message = await prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: { conversationId: id, senderId: me, body },
      });
      // Bump the conversation so it sorts to the top of the list.
      await tx.conversation.update({
        where: { id },
        data: { updatedAt: new Date() },
      });
      return created;
    });

    res.status(201).json({ message });
  }),
);

export default router;
