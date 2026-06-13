// End-to-end encryption for messages (X25519 + XSalsa20-Poly1305 via NaCl box).
//
// The private key is generated on-device and stored in the OS secure keystore;
// it never leaves the device. The server only ever sees public keys and
// ciphertext, so it cannot read message contents.
//
// This polyfill must load before tweetnacl uses randomBytes — keep it first.
import 'react-native-get-random-values';

import * as SecureStore from 'expo-secure-store';
import nacl from 'tweetnacl';
import { decodeBase64, decodeUTF8, encodeBase64, encodeUTF8 } from 'tweetnacl-util';

const SECRET_KEY_STORE = 'dipanix.e2ee.secretKey';

export interface KeyPair {
  publicKey: string; // base64
  secretKey: Uint8Array;
}

let cached: KeyPair | null = null;

/** Loads the device keypair, generating and persisting one on first use. */
export async function getOrCreateKeyPair(): Promise<KeyPair> {
  if (cached) return cached;

  const stored = await SecureStore.getItemAsync(SECRET_KEY_STORE);
  if (stored) {
    const secretKey = decodeBase64(stored);
    const pair = nacl.box.keyPair.fromSecretKey(secretKey);
    cached = { publicKey: encodeBase64(pair.publicKey), secretKey };
    return cached;
  }

  const generated = nacl.box.keyPair();
  await SecureStore.setItemAsync(SECRET_KEY_STORE, encodeBase64(generated.secretKey));
  cached = { publicKey: encodeBase64(generated.publicKey), secretKey: generated.secretKey };
  return cached;
}

/** This device's base64 public key (upload it via PUT /api/users/me/keys). */
export async function getPublicKey(): Promise<string> {
  return (await getOrCreateKeyPair()).publicKey;
}

export interface EncryptedPayload {
  ciphertext: string; // base64
  nonce: string; // base64
}

/** Encrypts plaintext for a recipient identified by their base64 public key. */
export async function encryptMessage(
  plaintext: string,
  recipientPublicKey: string,
): Promise<EncryptedPayload> {
  const { secretKey } = await getOrCreateKeyPair();
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const box = nacl.box(decodeUTF8(plaintext), nonce, decodeBase64(recipientPublicKey), secretKey);
  return { ciphertext: encodeBase64(box), nonce: encodeBase64(nonce) };
}

/**
 * Decrypts a message. `counterpartyPublicKey` is the OTHER participant's key:
 * for an incoming message that is the message's `senderPublicKey`; for an
 * outgoing message it is the recipient's `recipientPublicKey`. Returns null if
 * decryption/authentication fails.
 */
export async function decryptMessage(
  ciphertext: string,
  nonce: string,
  counterpartyPublicKey: string,
): Promise<string | null> {
  const { secretKey } = await getOrCreateKeyPair();
  const opened = nacl.box.open(
    decodeBase64(ciphertext),
    decodeBase64(nonce),
    decodeBase64(counterpartyPublicKey),
    secretKey,
  );
  return opened ? encodeUTF8(opened) : null;
}
