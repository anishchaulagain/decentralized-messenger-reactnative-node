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
| `JWT_EXPIRES_IN` | Token lifetime (default `7d`) |
| `ADMIN_USER_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | Seed admin credentials |
| `PORT` | Server port (default `3000`) |

## Auth

Send the token on protected routes: `Authorization: Bearer <token>`.

## Endpoints

### Public

| Method | Path | Body | Notes |
|---|---|---|---|
| `GET` | `/health` | — | Liveness check |
| `POST` | `/api/auth/register` | `{ name, email, password }` | Creates a `PENDING` user |
| `POST` | `/api/auth/login` | `{ email, password }` | Returns `{ token, user }`; 403 if pending/rejected |
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
| `GET` | `/api/users/search?email=` | — | Find an approved user by email + relationship state |
| `POST` | `/api/requests` | `{ recipientId }` | Send a message request |
| `GET` | `/api/requests/incoming` | — | Pending requests sent to me |
| `GET` | `/api/requests/outgoing` | — | Requests I sent |
| `POST` | `/api/requests/:id/accept` | — | Accept → creates a conversation |
| `POST` | `/api/requests/:id/reject` | — | Reject |

### Conversations & messages (approved users, participants only)

| Method | Path | Body | Notes |
|---|---|---|---|
| `GET` | `/api/conversations` | — | My conversations + last message + unread count |
| `GET` | `/api/conversations/:id/messages` | — | Messages (marks incoming as read) |
| `POST` | `/api/conversations/:id/messages` | `{ body }` | Send a message |

## Data model

`User` (role `USER`/`ADMIN`, status `PENDING`/`APPROVED`/`REJECTED`), `MessageRequest`
(`PENDING`/`ACCEPTED`/`REJECTED`), `Conversation` (one per user pair), `Message`. See
`prisma/schema.prisma`.

## Notes / next steps

- Real-time delivery is not implemented yet — messaging is REST polling. A Socket.IO
  layer over the same conversation/message model is the natural next step.
- Auth is stateless JWT; there is no refresh-token rotation or logout/blacklist yet.
