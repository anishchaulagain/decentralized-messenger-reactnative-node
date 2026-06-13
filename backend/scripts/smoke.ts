/**
 * End-to-end smoke test of the Dipanix API against a running server.
 * Exercises: admin login -> register users (pending) -> blocked login ->
 * admin approve -> user login -> search -> request -> accept -> chat.
 *
 * Run the server first (`npm run dev`), then: `npx tsx scripts/smoke.ts`
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import nacl from 'tweetnacl';
import {
  decodeBase64,
  decodeUTF8,
  encodeBase64,
  encodeUTF8,
} from 'tweetnacl-util';

const prisma = new PrismaClient();

// Client-side crypto, mirroring what the mobile app does (tweetnacl box).
function encrypt(plaintext: string, theirPublicKeyB64: string, mySecretKey: Uint8Array) {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const box = nacl.box(decodeUTF8(plaintext), nonce, decodeBase64(theirPublicKeyB64), mySecretKey);
  return { ciphertext: encodeBase64(box), nonce: encodeBase64(nonce) };
}

function decrypt(
  ciphertextB64: string,
  nonceB64: string,
  theirPublicKeyB64: string,
  mySecretKey: Uint8Array,
): string | null {
  const opened = nacl.box.open(
    decodeBase64(ciphertextB64),
    decodeBase64(nonceB64),
    decodeBase64(theirPublicKeyB64),
    mySecretKey,
  );
  return opened ? encodeUTF8(opened) : null;
}
const BASE = process.env.SMOKE_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
const stamp = Date.now();

let passed = 0;
function check(label: string, cond: boolean, extra?: unknown) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ ${label}`, extra ?? '');
    throw new Error(`Assertion failed: ${label}`);
  }
}

async function api(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<{ status: number; data: any }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

async function main() {
  const adminEmail = process.env.ADMIN_USER_EMAIL!;
  const adminPassword = process.env.ADMIN_PASSWORD!;
  const aliceEmail = `alice+${stamp}@example.com`;
  const bobEmail = `bob+${stamp}@example.com`;
  const pw = 'Password123!';

  console.log(`\nDipanix API smoke test → ${BASE}\n`);

  const health = await api('GET', '/health');
  check('health endpoint responds', health.status === 200 && health.data.status === 'ok');

  // Admin login
  const adminLogin = await api('POST', '/api/auth/login', {
    email: adminEmail,
    password: adminPassword,
  });
  check('admin can log in', adminLogin.status === 200 && !!adminLogin.data.accessToken, adminLogin.data);
  check('admin has ADMIN role', adminLogin.data.user.role === 'ADMIN');
  const adminToken = adminLogin.data.accessToken as string;

  // Register two users -> pending
  const regA = await api('POST', '/api/auth/register', {
    name: 'Alice',
    email: aliceEmail,
    password: pw,
  });
  check('register Alice -> 201 pending', regA.status === 201 && regA.data.user.status === 'PENDING');
  const regB = await api('POST', '/api/auth/register', {
    name: 'Bob',
    email: bobEmail,
    password: pw,
  });
  check('register Bob -> 201 pending', regB.status === 201 && regB.data.user.status === 'PENDING');

  // Duplicate email blocked
  const dup = await api('POST', '/api/auth/register', { name: 'Alice2', email: aliceEmail, password: pw });
  check('duplicate email -> 409', dup.status === 409, dup.data);

  // Pending user cannot log in
  const earlyLogin = await api('POST', '/api/auth/login', { email: aliceEmail, password: pw });
  check('pending user login -> 403', earlyLogin.status === 403, earlyLogin.data);

  // Admin sees pending users
  const pending = await api('GET', '/api/admin/users?status=PENDING', undefined, adminToken);
  const aliceId = pending.data.users.find((u: any) => u.email === aliceEmail)?.id;
  const bobId = pending.data.users.find((u: any) => u.email === bobEmail)?.id;
  check('admin lists pending users', !!aliceId && !!bobId);

  // Non-admin cannot reach admin routes (use a fresh approved user later); skip here.

  // Approve both
  const approveA = await api('POST', `/api/admin/users/${aliceId}/approve`, {}, adminToken);
  check('approve Alice', approveA.status === 200 && approveA.data.user.status === 'APPROVED');
  const approveB = await api('POST', `/api/admin/users/${bobId}/approve`, {}, adminToken);
  check('approve Bob', approveB.status === 200 && approveB.data.user.status === 'APPROVED');

  // Users can now log in
  const aliceLogin = await api('POST', '/api/auth/login', { email: aliceEmail, password: pw });
  check('Alice logs in', aliceLogin.status === 200 && !!aliceLogin.data.accessToken);
  check('login returns a refresh token', !!aliceLogin.data.refreshToken);
  const aliceToken = aliceLogin.data.accessToken as string;
  const bobLogin = await api('POST', '/api/auth/login', { email: bobEmail, password: pw });
  check('Bob logs in', bobLogin.status === 200 && !!bobLogin.data.accessToken);
  const bobToken = bobLogin.data.accessToken as string;

  // Each client generates an X25519 keypair; only the public half is uploaded.
  const aliceKeys = nacl.box.keyPair();
  const bobKeys = nacl.box.keyPair();
  const aliceKeyUp = await api('PUT', '/api/users/me/keys', { publicKey: encodeBase64(aliceKeys.publicKey) }, aliceToken);
  check('Alice uploads public key', aliceKeyUp.status === 200 && !!aliceKeyUp.data.user.publicKey);
  const bobKeyUp = await api('PUT', '/api/users/me/keys', { publicKey: encodeBase64(bobKeys.publicKey) }, bobToken);
  check('Bob uploads public key', bobKeyUp.status === 200 && !!bobKeyUp.data.user.publicKey);

  // Alice cannot reach admin routes
  const forbidden = await api('GET', '/api/admin/users', undefined, aliceToken);
  check('approved user blocked from admin routes -> 403', forbidden.status === 403);

  // Alice searches for Bob — and gets his public key for encryption
  const search = await api('GET', `/api/users/search?email=${encodeURIComponent(bobEmail)}`, undefined, aliceToken);
  check('search finds Bob', search.status === 200 && search.data.user.id === bobId);
  check('search returns Bob public key', search.data.user.publicKey === encodeBase64(bobKeys.publicKey));
  check('relationship is none', search.data.relationship.status === 'none', search.data.relationship);
  const bobPublicKey = search.data.user.publicKey as string;

  // Search for a nonexistent email
  const missing = await api('GET', `/api/users/search?email=nobody${stamp}@example.com`, undefined, aliceToken);
  check('search for unknown email -> 404', missing.status === 404);

  // Alice sends a request to Bob
  const sendReq = await api('POST', '/api/requests', { recipientId: bobId }, aliceToken);
  check('Alice sends request -> 201', sendReq.status === 201, sendReq.data);

  // Duplicate request blocked
  const dupReq = await api('POST', '/api/requests', { recipientId: bobId }, aliceToken);
  check('duplicate pending request -> 409', dupReq.status === 409);

  // Cannot chat before acceptance: Bob has no conversations yet
  const bobConvosBefore = await api('GET', '/api/conversations', undefined, bobToken);
  check('no conversation before acceptance', bobConvosBefore.data.conversations.length === 0);

  // Bob sees the incoming request
  const incoming = await api('GET', '/api/requests/incoming', undefined, bobToken);
  const reqId = incoming.data.requests.find((r: any) => r.requester.id === aliceId)?.id;
  check('Bob sees incoming request', !!reqId);

  // Bob accepts -> conversation created
  const accept = await api('POST', `/api/requests/${reqId}/accept`, {}, bobToken);
  check('Bob accepts request', accept.status === 200 && !!accept.data.conversation.id);
  const conversationId = accept.data.conversation.id as string;

  // Both now have the conversation
  const aliceConvos = await api('GET', '/api/conversations', undefined, aliceToken);
  check('Alice sees conversation with Bob', aliceConvos.data.conversations.some((c: any) => c.id === conversationId && c.contact.id === bobId));

  // Alice encrypts a message to Bob's public key and sends only ciphertext.
  const plaintext1 = 'Hey Bob! This is end-to-end encrypted.';
  const enc1 = encrypt(plaintext1, bobPublicKey, aliceKeys.secretKey);
  const msg1 = await api('POST', `/api/conversations/${conversationId}/messages`, enc1, aliceToken);
  check('Alice sends an encrypted message -> 201', msg1.status === 201, msg1.data);
  check('server never receives plaintext (no body field)', msg1.data.message.body === undefined);
  check('stored ciphertext is not the plaintext', msg1.data.message.ciphertext !== plaintext1);

  // The server stores ONLY ciphertext — verify directly in the database.
  const rowInDb = await prisma.message.findUnique({ where: { id: msg1.data.message.id } });
  check('DB row has no plaintext column', !('body' in (rowInDb as object)));
  check('DB ciphertext != plaintext', rowInDb?.ciphertext !== plaintext1);
  check(
    'a middle reader cannot decrypt without a private key',
    decrypt(rowInDb!.ciphertext, rowInDb!.nonce, rowInDb!.senderPublicKey, nacl.box.keyPair().secretKey) === null,
  );

  // Bob sees unread, then decrypts with his private key + Alice's public key.
  const bobConvos = await api('GET', '/api/conversations', undefined, bobToken);
  const bobConvo = bobConvos.data.conversations.find((c: any) => c.id === conversationId);
  check('Bob has 1 unread', bobConvo?.unreadCount === 1, bobConvo);
  const bobMsgs = await api('GET', `/api/conversations/${conversationId}/messages`, undefined, bobToken);
  const incomingForBob = bobMsgs.data.messages[0];
  const bobDecrypted = decrypt(
    incomingForBob.ciphertext,
    incomingForBob.nonce,
    incomingForBob.senderPublicKey,
    bobKeys.secretKey,
  );
  check('Bob decrypts Alice\'s message', bobDecrypted === plaintext1, bobDecrypted);

  // Bob replies (encrypted to Alice); Alice decrypts.
  const plaintext2 = 'Hi Alice! Encrypted reply.';
  const aliceFromBobView = bobConvo.contact.publicKey as string; // Alice's public key
  const enc2 = encrypt(plaintext2, aliceFromBobView, bobKeys.secretKey);
  await api('POST', `/api/conversations/${conversationId}/messages`, enc2, bobToken);

  const aliceMsgs = await api('GET', `/api/conversations/${conversationId}/messages`, undefined, aliceToken);
  check('conversation has 2 messages', aliceMsgs.data.messages.length === 2);
  const incomingForAlice = aliceMsgs.data.messages[1];
  const aliceDecrypted = decrypt(
    incomingForAlice.ciphertext,
    incomingForAlice.nonce,
    incomingForAlice.senderPublicKey,
    aliceKeys.secretKey,
  );
  check('Alice decrypts Bob\'s reply', aliceDecrypted === plaintext2, aliceDecrypted);

  // Invalid nonce length is rejected by validation.
  const badNonce = await api('POST', `/api/conversations/${conversationId}/messages`, { ciphertext: enc1.ciphertext, nonce: 'AAAA' }, aliceToken);
  check('invalid nonce -> 422', badNonce.status === 422);

  // Non-participant cannot read the conversation
  const adminPeek = await api('GET', `/api/conversations/${conversationId}/messages`, undefined, adminToken);
  check('non-participant blocked from messages -> 403/404', adminPeek.status === 403 || adminPeek.status === 404);

  // --- Access / refresh token lifecycle ---
  const freshLogin = await api('POST', '/api/auth/login', { email: aliceEmail, password: pw });
  const r0 = freshLogin.data.refreshToken as string;

  const refreshed = await api('POST', '/api/auth/refresh', { refreshToken: r0 });
  check('refresh returns a new token pair', refreshed.status === 200 && !!refreshed.data.accessToken && !!refreshed.data.refreshToken, refreshed.data);
  const r1 = refreshed.data.refreshToken as string;
  const a1 = refreshed.data.accessToken as string;

  const meWithNew = await api('GET', '/api/auth/me', undefined, a1);
  check('new access token works on /me', meWithNew.status === 200 && meWithNew.data.user.email === aliceEmail);

  const reuseOld = await api('POST', '/api/auth/refresh', { refreshToken: r0 });
  check('reusing a rotated refresh token -> 401', reuseOld.status === 401, reuseOld.data);

  const logout = await api('POST', '/api/auth/logout', { refreshToken: r1 });
  check('logout -> 204', logout.status === 204);

  const afterLogout = await api('POST', '/api/auth/refresh', { refreshToken: r1 });
  check('refresh after logout -> 401', afterLogout.status === 401);

  console.log(`\n✅ All ${passed} checks passed.\n`);
}

main()
  .catch((err) => {
    console.error('\n❌ Smoke test failed:', err.message, '\n');
    process.exitCode = 1;
  })
  .finally(async () => {
    // Remove the test users (cascades to their requests/conversations/messages).
    await prisma.user.deleteMany({ where: { email: { endsWith: '@example.com' } } });
    await prisma.$disconnect();
  });
