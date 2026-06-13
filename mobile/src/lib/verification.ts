// Tracks which conversations the user has manually verified (compared safety
// numbers and confirmed they match). Stored on-device.
import * as SecureStore from 'expo-secure-store';

const STORE_KEY = 'dipanix.verifiedConversations';

async function load(): Promise<Record<string, boolean>> {
  const raw = await SecureStore.getItemAsync(STORE_KEY);
  return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
}

export async function isVerified(conversationId: string): Promise<boolean> {
  return Boolean((await load())[conversationId]);
}

export async function setVerified(conversationId: string, verified: boolean): Promise<void> {
  const map = await load();
  if (verified) {
    map[conversationId] = true;
  } else {
    delete map[conversationId];
  }
  await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(map));
}
