import { Router } from 'express';

import { ApiError, asyncHandler } from '../lib/http-error';
import { prisma } from '../lib/prisma';
import { sendPushToUser } from '../lib/push';
import { emitToUsers, isUserOnline } from '../lib/realtime';
import { publicUserSelect, toPublicUser } from '../lib/serializers';
import { authenticate, requireApproved } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { editMessageSchema, reactionSchema, sendMessageSchema } from '../schemas';

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

// Fields the quoted (reply-to) message exposes — enough to decrypt a preview.
const replyPreviewSelect = {
  id: true,
  senderId: true,
  ciphertext: true,
  nonce: true,
  senderPublicKey: true,
  recipientPublicKey: true,
  deletedAt: true,
} as const;

// Fields returned for each (already-encrypted) message.
const messageSelect = {
  id: true,
  senderId: true,
  ciphertext: true,
  nonce: true,
  senderPublicKey: true,
  recipientPublicKey: true,
  readAt: true,
  editedAt: true,
  deletedAt: true,
  replyToId: true,
  replyTo: { select: replyPreviewSelect },
  reactions: { select: { userId: true, emoji: true } },
  createdAt: true,
} as const;

/** Both participant ids of a conversation (recipients of realtime updates). */
function bothParticipants(c: { userAId: string; userBId: string }): string[] {
  return [c.userAId, c.userBId];
}

/** Loads a message and asserts it belongs to the given conversation. */
async function loadConversationMessage(conversationId: string, messageId: string) {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message || message.conversationId !== conversationId) {
    throw new ApiError(404, 'Message not found');
  }
  return message;
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
    const conversation = await loadParticipantConversation(id, me);

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
      select: messageSelect,
    });

    const read = await prisma.message.updateMany({
      where: { conversationId: id, senderId: { not: me }, readAt: null },
      data: { readAt: new Date() },
    });

    // Tell the other participant their messages were read (live read receipts).
    if (read.count > 0) {
      const otherId =
        conversation.userAId === me ? conversation.userBId : conversation.userAId;
      emitToUsers([otherId], 'messages:read', { conversationId: id, readerId: me });
    }

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
    const { ciphertext, nonce, replyToId } = req.body as {
      ciphertext: string;
      nonce: string;
      replyToId?: string;
    };

    // A reply may only quote a (non-deleted) message in the same conversation.
    if (replyToId) {
      const replyTo = await loadConversationMessage(id, replyToId);
      if (replyTo.deletedAt) throw new ApiError(400, 'Cannot reply to a deleted message');
    }

    const otherId = conversation.userAId === me ? conversation.userBId : conversation.userAId;
    const [sender, recipient] = await Promise.all([
      prisma.user.findUnique({ where: { id: me }, select: { publicKey: true, name: true } }),
      prisma.user.findUnique({ where: { id: otherId }, select: { publicKey: true } }),
    ]);

    if (!sender?.publicKey) {
      throw new ApiError(400, 'Set up your encryption key before sending messages');
    }
    if (!recipient?.publicKey) {
      throw new ApiError(400, 'The recipient has not set up encryption yet');
    }

    // Batch (single round trip) — more robust over a high-latency cloud DB than
    // an interactive transaction. Also bumps the conversation to the top.
    const [message] = await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId: id,
          senderId: me,
          ciphertext,
          nonce,
          senderPublicKey: sender.publicKey!,
          recipientPublicKey: recipient.publicKey!,
          replyToId,
        },
        select: messageSelect,
      }),
      prisma.conversation.update({ where: { id }, data: { updatedAt: new Date() } }),
    ]);

    // Push the new (encrypted) message to both participants in real time.
    emitToUsers([me, otherId], 'message:new', { conversationId: id, message });

    // If the recipient has no live connection, the realtime event won't reach
    // them — fall back to a push notification. Content stays generic because the
    // server can't decrypt the message; the title is the sender's name and the
    // payload carries the conversation id for deep-linking. Fire-and-forget so a
    // push failure never affects the send response.
    if (!isUserOnline(otherId)) {
      void sendPushToUser(otherId, {
        title: sender?.name ?? 'New message',
        body: 'Sent you a message',
        data: { conversationId: id },
      });
    }

    res.status(201).json({ message });
  }),
);

// Edit a message: only the sender, only a non-deleted message. The client
// re-encrypts the new text; the server just swaps the ciphertext and stamps
// editedAt.
router.patch(
  '/:id/messages/:messageId',
  validateBody(editMessageSchema),
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const { id, messageId } = req.params as { id: string; messageId: string };
    const conversation = await loadParticipantConversation(id, me);
    const existing = await loadConversationMessage(id, messageId);

    if (existing.senderId !== me) throw new ApiError(403, 'You can only edit your own messages');
    if (existing.deletedAt) throw new ApiError(400, 'Cannot edit a deleted message');

    const { ciphertext, nonce } = req.body as { ciphertext: string; nonce: string };
    const message = await prisma.message.update({
      where: { id: messageId },
      data: { ciphertext, nonce, editedAt: new Date() },
      select: messageSelect,
    });

    emitToUsers(bothParticipants(conversation), 'message:updated', { conversationId: id, message });
    res.json({ message });
  }),
);

// Unsend a message: only the sender. Blanks the ciphertext/nonce (content is
// gone for everyone) and tombstones it. Reactions are removed too.
router.delete(
  '/:id/messages/:messageId',
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const { id, messageId } = req.params as { id: string; messageId: string };
    const conversation = await loadParticipantConversation(id, me);
    const existing = await loadConversationMessage(id, messageId);

    if (existing.senderId !== me) throw new ApiError(403, 'You can only delete your own messages');

    let message = null;
    if (!existing.deletedAt) {
      const [updated] = await prisma.$transaction([
        prisma.message.update({
          where: { id: messageId },
          data: { ciphertext: '', nonce: '', deletedAt: new Date() },
          select: messageSelect,
        }),
        prisma.reaction.deleteMany({ where: { messageId } }),
      ]);
      message = updated;
    }

    if (message) {
      emitToUsers(bothParticipants(conversation), 'message:updated', { conversationId: id, message });
    }
    res.json({ message });
  }),
);

// Toggle an emoji reaction on a message for the current user.
router.put(
  '/:id/messages/:messageId/reactions',
  validateBody(reactionSchema),
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const { id, messageId } = req.params as { id: string; messageId: string };
    const conversation = await loadParticipantConversation(id, me);
    const existing = await loadConversationMessage(id, messageId);
    if (existing.deletedAt) throw new ApiError(400, 'Cannot react to a deleted message');

    const { emoji } = req.body as { emoji: string };
    const found = await prisma.reaction.findUnique({
      where: { messageId_userId_emoji: { messageId, userId: me, emoji } },
    });
    if (found) {
      await prisma.reaction.delete({ where: { id: found.id } });
    } else {
      await prisma.reaction.create({ data: { messageId, userId: me, emoji } });
    }

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: messageSelect,
    });
    emitToUsers(bothParticipants(conversation), 'message:updated', { conversationId: id, message });
    res.json({ message });
  }),
);

export default router;
