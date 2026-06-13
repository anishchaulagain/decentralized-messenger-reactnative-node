import { Router } from 'express';

import { ApiError, asyncHandler } from '../lib/http-error';
import { signAccessToken } from '../lib/jwt';
import { hashPassword, verifyPassword } from '../lib/password';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { loginSchema, registerSchema } from '../schemas';

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
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new ApiError(401, 'Invalid email or password');
    }

    if (user.status === 'PENDING') {
      throw new ApiError(403, 'Your account is pending admin approval');
    }
    if (user.status === 'REJECTED') {
      throw new ApiError(403, 'Your account request was rejected');
    }

    const token = signAccessToken(user.id);
    const { passwordHash: _passwordHash, ...safeUser } = user;
    res.json({ token, user: safeUser });
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
