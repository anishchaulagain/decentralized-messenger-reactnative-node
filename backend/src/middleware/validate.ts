import type { NextFunction, Request, Response } from 'express';
import { z, type ZodType } from 'zod';

import { ApiError } from '../lib/http-error';

/** Validates and replaces req.body with the parsed result. */
export function validateBody(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(new ApiError(422, 'Validation failed', z.treeifyError(result.error)));
    }
    req.body = result.data;
    next();
  };
}

/**
 * Validates req.query and stashes the parsed result on res.locals.query.
 * (Express 5's req.query is read-only, so we don't reassign it.)
 */
export function validateQuery(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(new ApiError(422, 'Validation failed', z.treeifyError(result.error)));
    }
    res.locals.query = result.data;
    next();
  };
}
