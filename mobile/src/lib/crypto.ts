// End-to-end encryption for messages (X25519 + XSalsa20-Poly1305 via NaCl box).
//
// The private key is generated on-device and stored in the OS secure keystore;
// it never leaves the device. The server only ever sees public keys and
// ciphertext, so it cannot read message contents.
//
// This polyfill must load before tweetnacl uses randomBytes — keep it first.
import 'react-native-get-random-values';

import * as SecureStore from 'expo-secure-store';
import { scrypt } from 'scrypt-js';
import nacl from 'tweetnacl';
import { decodeBase64, decodeUTF8, encodeBase64, encodeUTF8 } from 'tweetnacl-util';

const SECRET_KEY_STORE = 'dipanix.e2ee.secretKey';

// scrypt work factors for the recovery-passphrase KDF (one-time backup/restore).
const SCRYPT = { N: 16384, r: 8, p: 1, dkLen: 32 };
const BACKUP_VERSION = 1;

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

/**
 * A human-readable "safety number" derived from both participants' public keys
 * (SHA-512, order-independent). Both devices compute the same value; the two
 * people compare it out-of-band. If it matches, no one (not even the server)
 * swapped a key in the middle — the conversation is verifiably E2E encrypted.
 *
 * Returns 12 groups of 5 digits (60 digits), like Signal's safety number.
 */
export function safetyNumber(publicKeyA: string, publicKeyB: string): string {
  const [k1, k2] = [publicKeyA, publicKeyB].sort(); // canonical order
  const combined = new Uint8Array([...decodeBase64(k1), ...decodeBase64(k2)]);
  const digest = nacl.hash(combined); // 64-byte SHA-512

  const groups: string[] = [];
  for (let i = 0; i < 12; i += 1) {
    let n = 0;
    for (let j = 0; j < 5; j += 1) {
      n = n * 256 + digest[i * 5 + j];
    }
    groups.push(String(n % 100000).padStart(5, '0'));
  }
  return groups.join(' ');
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

// --- Encrypted key backup (survives reinstall / new device) ---
//
// The private key is encrypted under a key derived from a user-chosen recovery
// passphrase (scrypt) and wrapped with NaCl secretbox. The resulting blob is
// uploaded to the server, which cannot read it without the passphrase. On a new
// device the user logs in, downloads the blob, and decrypts it with the
// passphrase — restoring the key and, because the server still holds all
// ciphertext, the entire message history.

interface BackupBlob {
  v: number;
  kdf: 'scrypt';
  N: number;
  r: number;
  p: number;
  salt: string; // base64
  nonce: string; // base64
  ciphertext: string; // base64 secretbox(secretKey)
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<Uint8Array> {
  const pw = decodeUTF8(passphrase.normalize('NFKC'));
  const key = await scrypt(pw, salt, SCRYPT.N, SCRYPT.r, SCRYPT.p, SCRYPT.dkLen);
  return new Uint8Array(key);
}

/** Produces an encrypted backup of this device's private key. Upload it via
 *  PUT /api/users/me/key-backup. */
export async function createEncryptedBackup(passphrase: string): Promise<string> {
  const { secretKey } = await getOrCreateKeyPair();
  const salt = nacl.randomBytes(16);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const wrappingKey = await deriveKey(passphrase, salt);
  const ciphertext = nacl.secretbox(secretKey, nonce, wrappingKey);

  const blob: BackupBlob = {
    v: BACKUP_VERSION,
    kdf: 'scrypt',
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    salt: encodeBase64(salt),
    nonce: encodeBase64(nonce),
    ciphertext: encodeBase64(ciphertext),
  };
  return JSON.stringify(blob);
}

/**
 * Restores the private key from an encrypted backup (downloaded from
 * GET /api/users/me/key-backup) using the recovery passphrase, and persists it
 * to the device. Throws if the passphrase is wrong or the blob is malformed.
 * Returns the restored public key.
 */
export async function restoreFromBackup(passphrase: string, blobJson: string): Promise<string> {
  const blob = JSON.parse(blobJson) as BackupBlob;
  const wrappingKey = await deriveKey(passphrase, decodeBase64(blob.salt));
  const secretKey = nacl.secretbox.open(
    decodeBase64(blob.ciphertext),
    decodeBase64(blob.nonce),
    wrappingKey,
  );
  if (!secretKey) {
    throw new Error('Incorrect recovery passphrase');
  }

  await SecureStore.setItemAsync(SECRET_KEY_STORE, encodeBase64(secretKey));
  const pair = nacl.box.keyPair.fromSecretKey(secretKey);
  cached = { publicKey: encodeBase64(pair.publicKey), secretKey };
  return cached.publicKey;
}
