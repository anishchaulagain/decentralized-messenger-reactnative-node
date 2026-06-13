// Sends push notifications to a user's devices via the Expo Push Service.
//
// The app is end-to-end encrypted, so the server cannot read message contents.
// Notifications therefore carry only metadata the server legitimately knows
// (e.g. the sender's name) plus a `data` payload for deep-linking — never any
// plaintext. The client can decrypt and enrich the notification locally.

import { env } from '../config/env';
import { prisma } from './prisma';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const MAX_PER_REQUEST = 100; // Expo accepts at most 100 messages per request.

export interface PushPayload {
  title: string;
  body: string;
  /** Small JSON payload delivered to the app (used for deep-linking). */
  data?: Record<string, unknown>;
}

interface ExpoPushMessage extends PushPayload {
  to: string;
  sound: 'default';
  priority: 'high';
  channelId: 'messages';
}

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Delivers a notification to every device registered for `userId`. Fire-and-
 * forget friendly: it never throws, logging failures instead, so a push outage
 * can't break the message-send request. Tokens Expo reports as unregistered are
 * pruned so we stop pushing to uninstalled/expired devices.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  try {
    const tokens = await prisma.pushToken.findMany({
      where: { userId },
      select: { token: true },
    });
    if (tokens.length === 0) return;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
    };
    if (env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${env.EXPO_ACCESS_TOKEN}`;

    for (const batch of chunk(tokens, MAX_PER_REQUEST)) {
      const messages: ExpoPushMessage[] = batch.map(({ token }) => ({
        to: token,
        sound: 'default',
        priority: 'high',
        channelId: 'messages',
        ...payload,
      }));

      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(messages),
      });

      if (!res.ok) {
        console.error(`Expo push failed (${res.status}): ${await res.text().catch(() => '')}`);
        continue;
      }

      const json = (await res.json()) as { data?: ExpoTicket[] };
      const tickets = json.data ?? [];

      // Tickets are returned in the same order as the messages we sent. Prune
      // any token Expo says is no longer registered to this device.
      const dead = batch
        .filter((_, i) => tickets[i]?.details?.error === 'DeviceNotRegistered')
        .map((t) => t.token);
      if (dead.length > 0) {
        await prisma.pushToken.deleteMany({ where: { token: { in: dead } } });
      }
    }
  } catch (err) {
    console.error('sendPushToUser error:', err);
  }
}
