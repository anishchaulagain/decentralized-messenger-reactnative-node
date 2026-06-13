import { Router } from 'express';

import { ApiError, asyncHandler } from '../lib/http-error';
import { signAccessToken } from '../lib/jwt';
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from '../lib/password';
import { prisma } from '../lib/prisma';
import {
  issueTokenPair,
  revokeRefreshToken,
  rotateRefreshToken,
} from '../lib/refresh-token';
import { authenticate } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { loginSchema, refreshSchema, registerSchema } from '../schemas';

const router = Router();

// Register a new account. Starts in PENDING — an admin must approve it before login.
router.post(
  '/register',
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body as {
      name: string;
      email: string;
      password: string;
    };

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ApiError(409, 'An account with this email already exists');
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(password),
        role: 'USER',
        status: 'PENDING',
      },
      omit: { passwordHash: true },
    });

    res.status(201).json({
      message: 'Account created. An administrator must approve it before you can sign in.',
      user,
    });
  }),
);

// Log in. Only APPROVED accounts receive a token.
router.post(
  '/login',
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as { email: string; password: string };

    const user = await prisma.user.findUnique({ where: { email } });
    // Always run a hash comparison (against a dummy hash when the user is
    // missing) so the response time doesn't reveal whether the email exists.
    const passwordOk = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!user || !passwordOk) {
      throw new ApiError(401, 'Invalid email or password');
    }

    if (user.deletedAt) {
      throw new ApiError(403, 'Your account has been deactivated');
    }
    if (user.status === 'PENDING') {
      throw new ApiError(403, 'Your account is pending admin approval');
    }
    if (user.status === 'REJECTED') {
      throw new ApiError(403, 'Your account request was rejected');
    }

    const tokens = await issueTokenPair(user.id);
    const { passwordHash: _passwordHash, ...safeUser } = user;
    res.json({ ...tokens, user: safeUser });
  }),
);

// Exchange a valid refresh token for a new access + refresh token pair.
// The old refresh token is rotated out (one-time use).
router.post(
  '/refresh',
  validateBody(refreshSchema),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body as { refreshToken: string };
    const { userId, refreshToken: newRefreshToken } = await rotateRefreshToken(refreshToken);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      omit: { passwordHash: true },
    });
    if (!user || user.deletedAt) {
      await revokeRefreshToken(newRefreshToken);
      throw new ApiError(401, 'Account is no longer active');
    }
    if (user.status !== 'APPROVED') {
      await revokeRefreshToken(newRefreshToken);
      throw new ApiError(403, 'Your account is not approved');
    }

    res.json({ accessToken: signAccessToken(userId), refreshToken: newRefreshToken, user });
  }),
);

// Revoke a refresh token (sign out). Access tokens expire on their own.
router.post(
  '/logout',
  validateBody(refreshSchema),
  asyncHandler(async (req, res) => {
    await revokeRefreshToken((req.body as { refreshToken: string }).refreshToken);
    res.status(204).send();
  }),
);

// Current authenticated user.
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  }),
);

export default router;
