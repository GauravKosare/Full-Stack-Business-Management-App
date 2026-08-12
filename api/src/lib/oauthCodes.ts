import crypto from "node:crypto";

/**
 * Single-use, short-lived codes exchanged for a JWT after OAuth callback, instead of
 * putting the JWT itself in the mobile deep-link redirect (which custom URL schemes
 * can leak to other apps on the device).
 *
 * In-memory only — fine for a single API instance in dev. A multi-instance deployment
 * needs a shared store (Redis) since a code minted on one instance must be exchangeable
 * on another.
 */
const TTL_MS = 60_000;
const codes = new Map<string, { userId: string; expiresAt: number }>();

export function createOneTimeCode(userId: string): string {
  const code = crypto.randomUUID();
  codes.set(code, { userId, expiresAt: Date.now() + TTL_MS });
  return code;
}

export function consumeOneTimeCode(code: string): string | null {
  const entry = codes.get(code);
  if (!entry) return null;
  codes.delete(code);
  return entry.expiresAt >= Date.now() ? entry.userId : null;
}
