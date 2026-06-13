import type { NextFunction, Request, Response } from 'express';

import { ApiError } from '../lib/http-error';
import { verifyAccessToken } from '../lib/jwt';
import { prisma } from '../lib/prisma';
import type { SafeUser } from '../lib/serializers';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SafeUser;
    }
  }
}

/** Verifies the Bearer token and loads the current user onto req.user. */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new ApiError(401, 'Authentication required');
    }
    const token = header.slice('Bearer '.length).trim();

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new ApiError(401, 'Invalid or expired token');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      omit: { passwordHash: true },
    });
    if (!user) {
      throw new ApiError(401, 'Account no longer exists');
    }
    if (user.deletedAt) {
      throw new ApiError(401, 'Account has been deactivated');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/** Requires the authenticated account to be approved by an admin. */
export function requireApproved(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new ApiError(401, 'Authentication required'));
  if (req.user.status !== 'APPROVED') {
    return next(new ApiError(403, 'Your account is not approved'));
  }
  next();
}

/** Requires the authenticated account to have the ADMIN role. */
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new ApiError(401, 'Authentication required'));
  if (req.user.role !== 'ADMIN') {
    return next(new ApiError(403, 'Admin access required'));
  }
  next();
}
