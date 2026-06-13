import type { Server as HttpServer } from 'node:http';

import { Server } from 'socket.io';

import { env } from '../config/env';
import { verifyAccessToken } from './jwt';
import { prisma } from './prisma';

let io: Server | null = null;

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
        select: { id: true, status: true, deletedAt: true },
      });
      if (!user || user.deletedAt || user.status !== 'APPROVED') {
        return next(new Error('unauthorized'));
      }

      socket.data.userId = user.id;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(socket.data.userId as string);
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
