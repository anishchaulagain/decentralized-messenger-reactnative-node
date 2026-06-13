// Ensures this device has an E2EE keypair ready after sign-in.
import { usersApi } from './api';
import { getPublicKey, hasStoredKeyPair } from './crypto';
import { patchUser } from './session';

export type KeyState = 'ready' | 'needs-restore';

/**
 * - Device already has a key  → make sure the server has the public half.
 * - No local key, server has a backup → caller must prompt for the recovery
 *   passphrase (returns 'needs-restore').
 * - No local key, no backup → generate a fresh keypair and upload it.
 */
export async function ensureKeysReady(): Promise<KeyState> {
  if (await hasStoredKeyPair()) {
    const publicKey = await getPublicKey();
    await usersApi.uploadPublicKey(publicKey).catch(() => undefined);
    await patchUser({ publicKey });
    return 'ready';
  }

  const { backup } = await usersApi.getBackup();
  if (backup) return 'needs-restore';

  const publicKey = await getPublicKey(); // generates + persists
  await usersApi.uploadPublicKey(publicKey);
  await patchUser({ publicKey });
  return 'ready';
}
