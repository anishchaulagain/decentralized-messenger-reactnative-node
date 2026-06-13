import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),
  PORT: z.coerce.number().default(3000),
  // Comma-separated allowed CORS origins; if unset, all origins are allowed
  // (fine for the native app, which doesn't use CORS — lock down for web).
  CORS_ORIGINS: z.string().optional(),
  // Number of proxy hops to trust for client IPs (set to 1+ behind a proxy/LB
  // so rate limiting keys off the real client IP). Default: trust none.
  TRUST_PROXY: z.coerce.number().default(0),
  // Rate-limit ceilings per IP per 15 minutes.
  AUTH_RATE_MAX: z.coerce.number().default(50),
  GENERAL_RATE_MAX: z.coerce.number().default(600),
  // Optional Expo push "Enhanced Security" access token. When set, it is sent
  // as a Bearer credential to the Expo push service so only your server can
  // push to your app's tokens. Leave unset to use the default (unauthenticated)
  // Expo push endpoint.
  EXPO_ACCESS_TOKEN: z.string().optional(),
  // Used only by the seed script.
  ADMIN_USER_EMAIL: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  ADMIN_NAME: z.string().default('Administrator'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', z.treeifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
