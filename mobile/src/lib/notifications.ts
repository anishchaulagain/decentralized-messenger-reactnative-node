// Push notifications for incoming messages.
//
// The server can't read message contents (E2EE), so a push only tells you who
// messaged you and carries the conversation id for deep-linking — never the
// text. Remote push requires a development build with FCM (Android) / APNs
// (iOS) credentials and an EAS projectId; it does NOT work in Expo Go.
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { notificationsApi } from './api';

const ANDROID_CHANNEL_ID = 'messages'; // must match the backend's channelId

// Show a banner + play a sound when a notification arrives while the app is
// foregrounded. Set once, at import time, before any notification is handled.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// The token last registered with the backend, kept so we can unregister it on
// sign-out (so a shared device stops getting the previous user's pushes).
let currentToken: string | null = null;

function resolveProjectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/**
 * Requests permission, obtains this device's Expo push token, and registers it
 * with the backend. Safe to call repeatedly (e.g. on every sign-in). No-ops on
 * simulators, when permission is denied, or when there's no EAS projectId — it
 * never throws, so it can't break the auth flow.
 */
export async function registerForPushNotifications(): Promise<void> {
  try {
    if (!Device.isDevice) return; // push tokens aren't issued on simulators

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: 'Messages',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#adc6ff',
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return;

    const projectId = resolveProjectId();
    if (!projectId) {
      console.warn(
        '[push] No EAS projectId found — run `eas init` and rebuild. Skipping push registration.',
      );
      return;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    currentToken = token;
    await notificationsApi.register(token, Platform.OS);
  } catch (err) {
    console.warn('[push] registration failed:', err);
  }
}

/** Removes this device's token from the backend (call on sign-out). */
export async function unregisterPushNotifications(): Promise<void> {
  if (!currentToken) return;
  try {
    await notificationsApi.unregister(currentToken);
  } catch {
    // best-effort; ignore
  } finally {
    currentToken = null;
  }
}

/** The conversation id carried by a tapped notification, if any. */
export function conversationIdFromResponse(
  response: Notifications.NotificationResponse | null,
): string | null {
  const data = response?.notification.request.content.data as
    | { conversationId?: string }
    | undefined;
  return data?.conversationId ?? null;
}
