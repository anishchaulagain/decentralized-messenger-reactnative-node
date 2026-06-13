import { Router } from 'express';

import { getRelationship } from '../lib/contacts';
import { ApiError, asyncHandler } from '../lib/http-error';
import { prisma } from '../lib/prisma';
import { toPublicUser } from '../lib/serializers';
import { authenticate, requireApproved } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  keyBackupSchema,
  registerPushTokenSchema,
  unregisterPushTokenSchema,
  updateAvatarSchema,
  updatePublicKeySchema,
  userSearchQuery,
} from '../schemas';

const router = Router();

router.use(authenticate, requireApproved);

// Update (or remove) the caller's profile photo. Stored as a small base64 data
// URI and exposed to contacts via the public-user shape.
router.put(
  '/me/avatar',
  validateBody(updateAvatarSchema),
  asyncHandler(async (req, res) => {
    const { avatar } = req.body as { avatar: string | null };
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { avatar },
      omit: { passwordHash: true },
    });
    res.json({ user });
  }),
);

// Register/replace the caller's E2EE public key. The private key stays on the
// device; the server only ever stores this public half.
router.put(
  '/me/keys',
  validateBody(updatePublicKeySchema),
  asyncHandler(async (req, res) => {
    const { publicKey } = req.body as { publicKey: string };
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { publicKey },
      omit: { passwordHash: true },
    });
    res.json({ user });
  }),
);

// Store the passphrase-encrypted private-key backup (opaque to the server).
router.put(
  '/me/key-backup',
  validateBody(keyBackupSchema),
  asyncHandler(async (req, res) => {
    const { backup } = req.body as { backup: string };
    await prisma.user.update({ where: { id: req.user!.id }, data: { keyBackup: backup } });
    res.json({ ok: true });
  }),
);

// Retrieve the encrypted backup (e.g. after reinstalling on a new device).
router.get(
  '/me/key-backup',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { keyBackup: true },
    });
    res.json({ backup: user?.keyBackup ?? null });
  }),
);

// Register (or refresh) this device's Expo push token so the server can send
// notifications for messages received while the app isn't connected. The token
// is globally unique to a device, so we reassign it to the current user if it
// was previously held by another account on this device.
router.put(
  '/me/push-token',
  validateBody(registerPushTokenSchema),
  asyncHandler(async (req, res) => {
    const { token, platform } = req.body as { token: string; platform?: string };
    await prisma.pushToken.upsert({
      where: { token },
      create: { token, platform, userId: req.user!.id },
      update: { userId: req.user!.id, platform },
    });
    res.json({ ok: true });
  }),
);

// Remove this device's push token (called on sign-out so a shared device stops
// receiving the previous user's notifications).
router.delete(
  '/me/push-token',
  validateBody(unregisterPushTokenSchema),
  asyncHandler(async (req, res) => {
    const { token } = req.body as { token: string };
    await prisma.pushToken.deleteMany({ where: { token, userId: req.user!.id } });
    res.json({ ok: true });
  }),
);

// Find an approved user by exact email so a message request can be sent.
router.get(
  '/search',
  validateQuery(userSearchQuery),
  asyncHandler(async (req, res) => {
    const { email } = res.locals.query as { email: string };

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== 'APPROVED' || user.deletedAt) {
      throw new ApiError(404, 'No user found with that email');
    }

    const relationship = await getRelationship(req.user!.id, user.id);
    res.json({ user: toPublicUser(user), relationship });
  }),
);

export default router;
