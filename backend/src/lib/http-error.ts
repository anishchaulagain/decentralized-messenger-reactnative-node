import type { RequestHandler } from 'express';

/** An error carrying an HTTP status code, surfaced by the error middleware. */
export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/** Wraps an async route handler so rejected promises reach the error middleware. */
export function asyncHandler(
  fn: (...args: Parameters<RequestHandler>) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
