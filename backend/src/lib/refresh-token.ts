import crypto from 'node:crypto';

import { env } from '../config/env';
import { ApiError } from './http-error';
import { signAccessToken } from './jwt';
import { prisma } from './prisma';

const DAY_MS = 24 * 60 * 60 * 1000;

function generateRawToken(): string {
  return crypto.randomBytes(48).toString('hex');
}

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function refreshExpiry(): Date {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * DAY_MS);
}

/** Creates a refresh token row and returns the raw (unhashed) token. */
export async function issueRefreshToken(userId: string): Promise<string> {
  const raw = generateRawToken();
  await prisma.refreshToken.create({
    data: { userId, tokenHash: hashToken(raw), expiresAt: refreshExpiry() },
  });
  return raw;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** Issues a fresh access + refresh token pair for a user. */
export async function issueTokenPair(userId: string): Promise<TokenPair> {
  return { accessToken: signAccessToken(userId), refreshToken: await issueRefreshToken(userId) };
}

/**
 * Rotates a refresh token: validates it, revokes it, and issues a replacement.
 * If a token that was already revoked is presented (reuse / theft), every
 * active token for that user is revoked and the request is rejected.
 */
export async function rotateRefreshToken(raw: string): Promise<{ userId: string; refreshToken: string }> {
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(raw) } });
  if (!existing) {
    throw new ApiError(401, 'Invalid refresh token');
  }

  if (existing.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: existing.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new ApiError(401, 'Refresh token has already been used');
  }

  if (existing.expiresAt.getTime() < Date.now()) {
    throw new ApiError(401, 'Refresh token expired');
  }

  const newRaw = generateRawToken();
  await prisma.$transaction(async (tx) => {
    const created = await tx.refreshToken.create({
      data: { userId: existing.userId, tokenHash: hashToken(newRaw), expiresAt: refreshExpiry() },
    });
    await tx.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), replacedById: created.id },
    });
  });

  return { userId: existing.userId, refreshToken: newRaw };
}

/** Revokes a single refresh token (used on logout). No-op if unknown. */
export async function revokeRefreshToken(raw: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(raw), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
