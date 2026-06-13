import { io, type Socket } from 'socket.io-client';

import { API_URL } from './config';
import { getSession } from './session';

let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) {
    socket = io(API_URL, {
      transports: ['websocket'],
      autoConnect: false,
      // Called on every (re)connection attempt, so it always uses the latest token.
      auth: (cb) => cb({ token: getSession()?.accessToken ?? '' }),
    });
  }
  return socket;
}

export function connectSocket(): void {
  const s = getSocket();
  if (!s.connected) s.connect();
}

export function disconnectSocket(): void {
  socket?.disconnect();
}

/** Emit an event to the server (no-op if the socket isn't connected). */
export function emitSocket(event: string, payload: unknown): void {
  const s = getSocket();
  if (s.connected) s.emit(event, payload);
}

/** Subscribe to a server event; returns an unsubscribe function. */
export function onSocket(event: string, handler: (payload: any) => void): () => void {
  const s = getSocket();
  s.on(event, handler);
  return () => {
    s.off(event, handler);
  };
}
