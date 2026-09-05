import crypto from "node:crypto";
import { prisma } from "./prisma";

/**
 * Single-use, short-lived codes exchanged for a JWT after OAuth callback, instead of
 * putting the JWT itself in the mobile deep-link redirect (which custom URL schemes
 * can leak to other apps on the device).
 *
 * Backed by Postgres, not an in-memory Map: the callback that creates a code and the
 * exchange request that consumes it are two separate HTTP requests, which on Vercel can
 * each land on a different serverless function instance — an in-memory store on one
 * instance is invisible to the other, which surfaced as intermittent "invalid_code"
 * failures. A shared table fixes that at the cost of one extra query per auth attempt.
 */
const TTL_MS = 60_000;

export async function createOneTimeCode(userId: string): Promise<string> {
  const code = crypto.randomUUID();
  await prisma.oneTimeCode.create({
    data: { code, userId, expiresAt: new Date(Date.now() + TTL_MS) },
  });
  return code;
}

export async function consumeOneTimeCode(code: string): Promise<string | null> {
  // Delete-and-return in one round trip so two concurrent exchange attempts with the
  // same code can't both succeed (deleteMany's count tells us whether *this* call was
  // the one that actually removed the row).
  const entry = await prisma.oneTimeCode.findUnique({ where: { code } });
  if (!entry) return null;

  const { count } = await prisma.oneTimeCode.deleteMany({ where: { code } });
  if (count === 0) return null;

  return entry.expiresAt.getTime() >= Date.now() ? entry.userId : null;
}
