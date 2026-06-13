import { prisma } from './prisma';

/** Orders a pair of user ids so each pair maps to one conversation row. */
export function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export function findConversationBetween(a: string, b: string) {
  const [userAId, userBId] = orderedPair(a, b);
  return prisma.conversation.findUnique({ where: { userAId_userBId: { userAId, userBId } } });
}

export type Relationship =
  | { status: 'self' }
  | { status: 'none' }
  | { status: 'request_sent'; requestId: string }
  | { status: 'request_received'; requestId: string }
  | { status: 'connected'; conversationId: string };

/** Describes how `meId` is related to `otherId` (for search results / UI state). */
export async function getRelationship(meId: string, otherId: string): Promise<Relationship> {
  if (meId === otherId) return { status: 'self' };

  const conversation = await findConversationBetween(meId, otherId);
  if (conversation) return { status: 'connected', conversationId: conversation.id };

  const [sent, received] = await Promise.all([
    prisma.messageRequest.findUnique({
      where: { requesterId_recipientId: { requesterId: meId, recipientId: otherId } },
    }),
    prisma.messageRequest.findUnique({
      where: { requesterId_recipientId: { requesterId: otherId, recipientId: meId } },
    }),
  ]);

  if (sent?.status === 'PENDING') return { status: 'request_sent', requestId: sent.id };
  if (received?.status === 'PENDING') return { status: 'request_received', requestId: received.id };
  return { status: 'none' };
}
