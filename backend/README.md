# Dipanix API

Express 5 + TypeScript + Prisma (PostgreSQL) + JWT auth.

## Flow

1. A user **registers** → account is created in `PENDING` state (cannot log in yet).
2. An **admin approves or rejects** the account.
3. Once `APPROVED`, the user can **log in** and receives a JWT.
4. A logged-in user **searches another user by email** and **sends a message request**.
5. The recipient **accepts** the request → a **conversation** is created.
6. Only then can the two users **exchange messages**.

## Setup

```bash
cd backend
npm install
npm run db:create   # creates the `dipanix` database on the server in DATABASE_URL
npm run db:push     # creates tables from prisma/schema.prisma
npm run db:seed     # seeds the admin from ADMIN_USER_EMAIL / ADMIN_PASSWORD in .env
npm run dev         # start the API (http://localhost:3000)
```

Other scripts: `npm run build` (compile to `dist/`), `npm start` (run build), `npm run smoke` (end-to-end test against a running server), `npm run db:studio` (Prisma Studio).

## Environment (`.env`)

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (points at the `dipanix` database) |
| `JWT_SECRET` | Secret used to sign access tokens |
| `ACCESS_TOKEN_TTL` | Access-token lifetime (default `15m`) |
| `REFRESH_TOKEN_TTL_DAYS` | Refresh-token lifetime in days (default `30`) |
| `ADMIN_USER_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | Seed admin credentials |
| `PORT` | Server port (default `3000`) |
| `CORS_ORIGINS` | Comma-separated allowed web origins (unset = allow all; native app is unaffected) |
| `TRUST_PROXY` | Proxy hops to trust for client IP (set `1`+ behind a proxy/LB) |
| `AUTH_RATE_MAX` / `GENERAL_RATE_MAX` | Per-IP request ceilings / 15 min (default `50` / `600`) |

## Auth

Login returns a short-lived **access token** and a long-lived **refresh token**.
Send the access token on protected routes: `Authorization: Bearer <accessToken>`.
When it expires, call `POST /api/auth/refresh` with the refresh token to get a new
pair — refresh tokens are rotated on every use (one-time), stored hashed, and revoked
on logout. Reusing a rotated token revokes the whole chain (theft protection).

## Endpoints

### Public

| Method | Path | Body | Notes |
|---|---|---|---|
| `GET` | `/health` | — | Liveness check |
| `POST` | `/api/auth/register` | `{ name, email, password }` | Creates a `PENDING` user |
| `POST` | `/api/auth/login` | `{ email, password }` | Returns `{ accessToken, refreshToken, user }`; 403 if pending/rejected |
| `POST` | `/api/auth/refresh` | `{ refreshToken }` | Rotates and returns a new `{ accessToken, refreshToken, user }` |
| `POST` | `/api/auth/logout` | `{ refreshToken }` | Revokes the refresh token (204) |
| `GET` | `/api/auth/me` | — (auth) | Current user |

### Admin (role `ADMIN`)

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/admin/users?status=PENDING&search=` | List/filter users |
| `POST` | `/api/admin/users/:id/approve` | Approve an account |
| `POST` | `/api/admin/users/:id/reject` | Reject an account |

### Users & requests (approved users)

| Method | Path | Body | Notes |
|---|---|---|---|
| `PUT` | `/api/users/me/keys` | `{ publicKey }` | Register/replace your E2EE public key (base64 X25519) |
| `PUT` | `/api/users/me/key-backup` | `{ backup }` | Store the passphrase-encrypted private-key backup (opaque blob) |
| `GET` | `/api/users/me/key-backup` | — | Fetch the encrypted backup (for recovery after reinstall) |
| `GET` | `/api/users/search?email=` | — | Find an approved user by email (incl. their public key) + relationship state |
| `POST` | `/api/requests` | `{ recipientId }` | Send a message request |
| `GET` | `/api/requests/incoming` | — | Pending requests sent to me |
| `GET` | `/api/requests/outgoing` | — | Requests I sent |
| `POST` | `/api/requests/:id/accept` | — | Accept → creates a conversation |
| `POST` | `/api/requests/:id/reject` | — | Reject |

### Conversations & messages (approved users, participants only)

| Method | Path | Body | Notes |
|---|---|---|---|
| `GET` | `/api/conversations` | — | My conversations + last (encrypted) message + unread count |
| `GET` | `/api/conversations/:id/messages` | — | Encrypted messages (marks incoming as read) |
| `POST` | `/api/conversations/:id/messages` | `{ ciphertext, nonce }` | Send an encrypted message (client encrypts first) |

## End-to-end encryption

Messages are end-to-end encrypted — **the server only ever stores ciphertext and
public keys, never plaintext and never a private key.** Anyone in the middle (the
API, the database, the network) sees only opaque ciphertext.

**Scheme:** NaCl `box` — X25519 key agreement + XSalsa20-Poly1305 authenticated
encryption (`tweetnacl`).

1. Each device generates an X25519 keypair. The **private key never leaves the
   device** (mobile stores it in the OS secure keystore via `expo-secure-store`).
2. The **public key** is uploaded with `PUT /api/users/me/keys` and returned in
   search results / conversation contacts.
3. To send, the client encrypts with the **recipient's public key** + its own
   private key and posts `{ ciphertext, nonce }`. The server snapshots both
   parties' public keys on the row (so decryption survives a later key rotation).
4. To read, the client decrypts with its **own private key** + the counterparty's
   public key (`senderPublicKey` for incoming, `recipientPublicKey` for outgoing).

The shared secret is symmetric, so both participants — and only they — can decrypt.
Client crypto lives in `mobile/src/lib/crypto.ts`; the backend smoke test
(`npm run smoke`) exercises the full encrypt → store → decrypt round-trip and
asserts the database never holds plaintext.

### Key verification (anti-MITM)

Because the server distributes public keys, a malicious server could swap one in.
The client derives a **safety number** (SHA-512 of both public keys, order-independent
— 12 groups of 5 digits, like Signal) that both people compare out-of-band. If it
matches, no key was substituted. See `safetyNumber()` in `mobile/src/lib/crypto.ts`
and the verify screen at `mobile/src/app/verify/[id].tsx`.

### Encrypted key backup & recovery (survives reinstall)

The private key normally lives only on the device, so reinstalling would lose it —
and with it, the ability to read message history. To recover:

1. The client encrypts its private key under a **user-chosen recovery passphrase**
   (scrypt KDF → NaCl secretbox) and uploads the opaque blob (`PUT /me/key-backup`).
   The server stores it but **cannot decrypt it** without the passphrase.
2. After reinstalling, the user logs in, downloads the blob (`GET /me/key-backup`),
   and enters the passphrase to restore the exact same private key.
3. Since the server still holds all message **ciphertext**, restoring the key makes
   the **entire history decryptable again** — no separate message backup needed.

The smoke test proves this end-to-end: back up → simulate reinstall (wipe key) →
restore with passphrase → decrypt a historical message (and confirms a wrong
passphrase fails). `createEncryptedBackup()` / `restoreFromBackup()` live in
`mobile/src/lib/crypto.ts`.

> The backup's security rests on passphrase strength (scrypt slows brute force).
> For high-value deployments, add server-side rate-limiting / an HSM-backed recovery
> service (à la Signal SVR). The recovery passphrase is independent of the login
> password and is never sent to the server.

**Not yet implemented:** forward secrecy. A single long-term keypair per user means
a leaked private key exposes past messages. A Double-Ratchet layer (Signal-style)
is the natural upgrade. Key rotation also currently orphans messages encrypted to
the old key.

## Data model

`User` (role `USER`/`ADMIN`, status `PENDING`/`APPROVED`/`REJECTED`), `MessageRequest`
(`PENDING`/`ACCEPTED`/`REJECTED`), `Conversation` (one per user pair), `Message`,
`RefreshToken` (hashed, rotating). See `prisma/schema.prisma`.

## Security posture

What's in place:

- **E2EE messages** — server stores only ciphertext (see above).
- **Passwords** — bcrypt (cost 12); login runs a constant-time comparison even
  for unknown emails (no user enumeration via timing); generic `Invalid email or
  password` error.
- **Tokens** — short-lived access JWT (HS256, algorithm + issuer pinned to block
  `alg:none`/confusion) + rotating, hashed, revocable refresh tokens with reuse
  detection.
- **Rate limiting** — strict per-IP ceiling on `/api/auth`, broad ceiling on the
  rest of the API.
- **Transport/app** — `helmet` security headers, configurable CORS allowlist,
  64 KB JSON body limit, `trust proxy` for correct client-IP attribution.
- **Input** — every request body/query validated with `zod`; Prisma parameterizes
  all SQL.
- **Authorization** — role (`ADMIN`) and account-status (`APPROVED`) guards;
  conversation access restricted to participants; users can only act on their own
  requests.

Hardening still recommended before production:

- **Serve over TLS only** (terminate HTTPS at the proxy/LB) — the bearer tokens and
  ciphertext are confidential in transit only under TLS.
- **Forward secrecy** — messages use one long-term keypair per user, so a leaked
  private key exposes past messages. Add a Double-Ratchet layer (use a vetted
  library such as libsignal — do not hand-roll it).
- **Public-key verification** — a malicious server could substitute public keys
  (MITM). Surface a key fingerprint / safety number in the client for out-of-band
  verification.
- **Secret management** — keep `JWT_SECRET` / DB creds in a secrets manager, rotate
  periodically; scope the DB user to least privilege.
- **Refresh-token cleanup** — prune expired/revoked rows on a schedule.

## Notes / next steps

- Real-time delivery is not implemented yet — messaging is REST polling. A Socket.IO
  layer over the same conversation/message model is the natural next step.
