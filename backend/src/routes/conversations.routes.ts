import { Router } from 'express';

import { ApiError, asyncHandler } from '../lib/http-error';
import { prisma } from '../lib/prisma';
import { publicUserSelect, toPublicUser } from '../lib/serializers';
import { authenticate, requireApproved } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { sendMessageSchema } from '../schemas';

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

// Fields returned for each (already-encrypted) message.
const messageSelect = {
  id: true,
  senderId: true,
  ciphertext: true,
  nonce: true,
  senderPublicKey: true,
  recipientPublicKey: true,
  readAt: true,
  createdAt: true,
} as const;

// List my conversations with the other participant, last message, and unread count.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const me = req.user!.id;

    const conversations = await prisma.conversation.findMany({
      where: { OR: [{ userAId: me }, { userBId: me }] },
      orderBy: { updatedAt: 'desc' },
      include: {
        userA: { select: publicUserSelect },
        userB: { select: publicUserSelect },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: messageSelect },
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

// Fetch encrypted messages for a conversation (oldest first) and mark incoming read.
// The server returns ciphertext only — the client decrypts with its private key.
router.get(
  '/:id/messages',
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const { id } = req.params as { id: string };
    await loadParticipantConversation(id, me);

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
      select: messageSelect,
    });

    await prisma.message.updateMany({
      where: { conversationId: id, senderId: { not: me }, readAt: null },
      data: { readAt: new Date() },
    });

    res.json({ messages });
  }),
);

// Send an end-to-end encrypted message. The client must encrypt the body with
// the recipient's public key before calling this — the server never sees plaintext.
router.post(
  '/:id/messages',
  validateBody(sendMessageSchema),
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const { id } = req.params as { id: string };
    const conversation = await loadParticipantConversation(id, me);
    const { ciphertext, nonce } = req.body as { ciphertext: string; nonce: string };

    const otherId = conversation.userAId === me ? conversation.userBId : conversation.userAId;
    const [sender, recipient] = await Promise.all([
      prisma.user.findUnique({ where: { id: me }, select: { publicKey: true } }),
      prisma.user.findUnique({ where: { id: otherId }, select: { publicKey: true } }),
    ]);

    if (!sender?.publicKey) {
      throw new ApiError(400, 'Set up your encryption key before sending messages');
    }
    if (!recipient?.publicKey) {
      throw new ApiError(400, 'The recipient has not set up encryption yet');
    }

    const message = await prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          conversationId: id,
          senderId: me,
          ciphertext,
          nonce,
          senderPublicKey: sender.publicKey!,
          recipientPublicKey: recipient.publicKey!,
        },
        select: messageSelect,
      });
      // Bump the conversation so it sorts to the top of the list.
      await tx.conversation.update({ where: { id }, data: { updatedAt: new Date() } });
      return created;
    });

    res.status(201).json({ message });
  }),
);

export default router;
