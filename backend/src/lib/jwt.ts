import jwt, { type SignOptions } from 'jsonwebtoken';

import { env } from '../config/env';

export interface AccessTokenPayload {
  sub: string; // user id
}

const ISSUER = 'dipanix';

export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, {
    algorithm: 'HS256',
    issuer: ISSUER,
    expiresIn: env.ACCESS_TOKEN_TTL as SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  // Pin the algorithm and issuer to block algorithm-confusion / "alg: none".
  return jwt.verify(token, env.JWT_SECRET, {
    algorithms: ['HS256'],
    issuer: ISSUER,
  }) as AccessTokenPayload;
}
