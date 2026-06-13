import rateLimit from 'express-rate-limit';

import { env } from '../config/env';

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const shared = {
  windowMs: WINDOW_MS,
  standardHeaders: true,
  legacyHeaders: false,
};

// Broad ceiling for the whole API.
export const generalLimiter = rateLimit({
  ...shared,
  max: env.GENERAL_RATE_MAX,
  message: { error: 'Too many requests, please slow down' },
});

// Tighter ceiling for auth endpoints (login / register / refresh) to throttle
// credential-stuffing and brute-force attempts.
export const authLimiter = rateLimit({
  ...shared,
  max: env.AUTH_RATE_MAX,
  message: { error: 'Too many attempts, please try again later' },
});
