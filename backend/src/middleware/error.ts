import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';

import { ApiError } from '../lib/http-error';

export function notFound(_req: Request, _res: Response, next: NextFunction) {
  next(new ApiError(404, 'Route not found'));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }

  // Unique-constraint violation -> 409.
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    return res.status(409).json({ error: 'A record with these details already exists' });
  }

  console.error('Unhandled error:', err);
  return res.status(500).json({ error: 'Internal server error' });
}
