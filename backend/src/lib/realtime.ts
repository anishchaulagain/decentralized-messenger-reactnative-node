import type { Server as HttpServer } from 'node:http';

import { Server } from 'socket.io';

import { env } from '../config/env';
import { verifyAccessToken } from './jwt';
import { prisma } from './prisma';
import { sendPushToUser } from './push';

let io: Server | null = null;

/** A relayed call-signaling message. Payloads (sdp/candidate) are opaque to us. */
interface CallSignal {
  conversationId?: string;
  callId?: string;
  callType?: 'audio' | 'video';
  [key: string]: unknown;
}

/** All user ids this user shares a conversation with (their "contacts"). */
async function contactsOf(userId: string): Promise<string[]> {
  const convos = await prisma.conversation.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    select: { userAId: true, userBId: true },
  });
  const ids = new Set<string>();
  for (const c of convos) ids.add(c.userAId === userId ? c.userBId : c.userAId);
  return [...ids];
}

/** Tells a user's contacts they came online or went offline. */
async function broadcastPresence(
  userId: string,
  online: boolean,
  lastSeenAt: Date | null,
): Promise<void> {
  const contacts = await contactsOf(userId);
  for (const id of contacts) {
    io?.to(id).emit('presence', { userId, online, lastSeenAt });
  }
}

/**
 * Returns the other participant's id if `userId` belongs to the conversation,
 * else null. Used to authorize and route relayed events (typing, calls).
 */
async function otherParticipant(
  conversationId: string | undefined,
  userId: string,
): Promise<string | null> {
  if (typeof conversationId !== 'string') return null;
  const convo = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { userAId: true, userBId: true },
  });
  if (!convo) return null;
  if (convo.userAId !== userId && convo.userBId !== userId) return null;
  return convo.userAId === userId ? convo.userBId : convo.userAId;
}

/**
 * Attaches an authenticated Socket.IO server to the HTTP server. Each client
 * authenticates with its JWT access token at handshake and joins a room named
 * by its user id, so we can push events to a specific user across their devices.
 */
export function initRealtime(server: HttpServer): Server {
  const origins = env.CORS_ORIGINS?.split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  io = new Server(server, {
    cors: { origin: origins && origins.length ? origins : '*' },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error('unauthorized'));

      const payload = verifyAccessToken(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, name: true, status: true, deletedAt: true },
      });
      if (!user || user.deletedAt || user.status !== 'APPROVED') {
        return next(new Error('unauthorized'));
      }

      socket.data.userId = user.id;
      socket.data.name = user.name;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;
    socket.join(userId);

    // Tell this user's contacts they're online. (Fires per connection; a contact
    // coming online while offline picks up the current state via the snapshot in
    // the conversations list.)
    void broadcastPresence(userId, true, null);

    socket.on('disconnect', () => {
      // Only mark offline once the user's LAST socket is gone (multi-device). By
      // the time 'disconnect' fires this socket has left its rooms, so
      // isUserOnline reflects whether any other connection remains.
      if (!isUserOnline(userId)) {
        const now = new Date();
        prisma.user
          .update({ where: { id: userId }, data: { lastSeenAt: now } })
          .catch(() => undefined);
        void broadcastPresence(userId, false, now);
      }
    });

    // Relay typing indicators to the other participant. Validated against the
    // DB so a client can't spoof typing into a conversation it isn't part of.
    // Clients debounce these (start/stop only), so the per-event lookup is cheap.
    socket.on('typing', async (payload: { conversationId?: string; typing?: boolean }) => {
      const otherId = await otherParticipant(payload?.conversationId, userId);
      if (otherId) {
        io?.to(otherId).emit('typing', {
          conversationId: payload!.conversationId,
          userId,
          typing: !!payload?.typing,
        });
      }
    });

    // --- Call signaling (WebRTC) ---
    // The server is a blind relay: SDP offers/answers and ICE candidates are
    // encrypted client-side with the recipient's key, so it forwards opaque
    // blobs and can neither read nor tamper with them. It only checks that the
    // sender is a participant of the conversation and routes by user id.
    const relayCall = (event: string) => async (payload: CallSignal) => {
      const otherId = await otherParticipant(payload?.conversationId, userId);
      if (otherId) io?.to(otherId).emit(event, { ...payload, from: userId });
    };

    // Offer is special: if the callee has no live connection there's no one to
    // ring — tell the caller and push a missed-call notification instead.
    socket.on('call:offer', async (payload: CallSignal) => {
      const otherId = await otherParticipant(payload?.conversationId, userId);
      if (!otherId) return;
      if (!isUserOnline(otherId)) {
        io?.to(userId).emit('call:unavailable', {
          conversationId: payload.conversationId,
          callId: payload.callId,
        });
        void sendPushToUser(otherId, {
          title: (socket.data.name as string) ?? 'Missed call',
          body: payload.callType === 'video' ? 'Missed video call' : 'Missed voice call',
          data: { conversationId: payload.conversationId, type: 'request' },
        });
        return;
      }
      io?.to(otherId).emit('call:incoming', { ...payload, from: userId });
    });

    socket.on('call:answer', relayCall('call:answer'));
    socket.on('call:ice', relayCall('call:ice'));
    socket.on('call:reject', relayCall('call:reject'));
    socket.on('call:hangup', relayCall('call:hangup'));
  });

  return io;
}

/**
 * Whether a user has at least one live socket connection (i.e. the app is open
 * and connected). Used to decide whether a message needs a push notification:
 * if the user is online, the realtime event already delivers it. Single-node
 * check — revisit if Socket.IO is scaled out with a Redis adapter.
 */
export function isUserOnline(userId: string): boolean {
  if (!io) return false;
  const room = io.sockets.adapter.rooms.get(userId);
  return !!room && room.size > 0;
}

/** Pushes an event to one or more users' rooms (no-op before init). */
export function emitToUsers(userIds: string[], event: string, payload: unknown): void {
  if (!io) return;
  for (const userId of userIds) {
    io.to(userId).emit(event, payload);
  }
}
