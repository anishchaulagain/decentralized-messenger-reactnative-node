import type { EncryptedMessage } from './api';
import { decryptMessage } from './crypto';

/**
 * Decrypts a message for the current user. The counterparty's public key is the
 * recipient's key for messages we sent, and the sender's key for ones we received.
 */
export async function decryptForMe(
  message: EncryptedMessage,
  myUserId: string,
): Promise<string | null> {
  const counterpartyKey =
    message.senderId === myUserId ? message.recipientPublicKey : message.senderPublicKey;
  return decryptMessage(message.ciphertext, message.nonce, counterpartyKey);
}
