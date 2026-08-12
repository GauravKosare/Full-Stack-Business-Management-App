import crypto from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { passport, isGoogleAuthConfigured } from "../lib/passport";
import { signAuthToken } from "../lib/jwt";
import { createOneTimeCode, consumeOneTimeCode } from "../lib/oauthCodes";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import type { User } from "@prisma/client";

export const authRouter = Router();

const OAUTH_STATE_COOKIE = "oauth_state";
const OAUTH_PLATFORM_COOKIE = "oauth_platform";
const OAUTH_MOBILE_REDIRECT_COOKIE = "oauth_mobile_redirect";

type Platform = "mobile" | "web";

// Unlike MOBILE_AUTH_REDIRECT_URL (whose myapp:// fallback fails obviously — no
// browser resolves a custom scheme it doesn't recognize), a forgotten WEB_APP_URL
// would silently redirect real users to localhost in production. Guard it the same
// way isGoogleAuthConfigured/isRazorpayConfigured guard their own routes.
const isWebAuthConfigured = Boolean(process.env.WEB_APP_URL);

// Under Expo Go, expo-linking's createURL() can't produce the app's real "myapp://"
// scheme (Expo Go doesn't register third-party custom schemes) — it produces a
// session-specific "exp://<lan-ip>:<port>/--/auth" URL instead, which changes per dev
// session. A fixed MOBILE_AUTH_REDIRECT_URL can't account for that, so the mobile
// client passes its actual computed redirect_uri and we use it if it looks legitimate.
// The one-time code is bearer-equivalent to a login, so this can't be an open
// allow-list: exp:// is only accepted outside production, and only the real "myapp://"
// scheme is ever accepted when NODE_ENV=production.
function isAllowedMobileRedirectUri(uri: string): boolean {
  if (uri.startsWith("myapp://")) return true;
  if (process.env.NODE_ENV !== "production" && (uri.startsWith("exp://") || uri.startsWith("exp+"))) return true;
  return false;
}

// GET /api/v1/auth/google?platform=web|mobile (default mobile) — sets a random CSRF
// state in an httpOnly cookie and passes the same value through the OAuth redirect;
// verified against each other on callback. (passport-oauth2's own state handling
// requires a session, which we don't use.) The platform is stashed in a second cookie
// so the callback knows which client to redirect back to — see the platform-aware
// redirect logic below.
authRouter.get("/google", (req, res, next) => {
  if (!isGoogleAuthConfigured) {
    return res
      .status(501)
      .json({ error: { code: "not_configured", message: "Google sign-in is not configured on this server yet" } });
  }

  const platform: Platform = req.query.platform === "web" ? "web" : "mobile";

  if (platform === "web" && !isWebAuthConfigured) {
    return res
      .status(501)
      .json({ error: { code: "not_configured", message: "Web sign-in is not configured on this server yet (WEB_APP_URL unset)" } });
  }

  const state = crypto.randomBytes(16).toString("hex");

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 5 * 60 * 1000,
  };
  res.cookie(OAUTH_STATE_COOKIE, state, cookieOptions);
  res.cookie(OAUTH_PLATFORM_COOKIE, platform, cookieOptions);

  if (platform === "mobile") {
    const requestedRedirect = req.query.redirect_uri;
    if (typeof requestedRedirect === "string" && isAllowedMobileRedirectUri(requestedRedirect)) {
      res.cookie(OAUTH_MOBILE_REDIRECT_COOKIE, requestedRedirect, cookieOptions);
    }
  }

  passport.authenticate("google", { scope: ["profile", "email"], session: false, state })(req, res, next);
});

authRouter.get(
  "/google/callback",
  (req, res, next) => {
    if (!isGoogleAuthConfigured) {
      return res
        .status(501)
        .json({ error: { code: "not_configured", message: "Google sign-in is not configured on this server yet" } });
    }

    const expectedState = req.cookies?.[OAUTH_STATE_COOKIE];
    if (!expectedState || expectedState !== req.query.state) {
      res.clearCookie(OAUTH_STATE_COOKIE);
      res.clearCookie(OAUTH_PLATFORM_COOKIE);
      res.clearCookie(OAUTH_MOBILE_REDIRECT_COOKIE);
      return res.status(401).json({ error: { code: "invalid_state", message: "OAuth state mismatch" } });
    }
    next();
  },
  passport.authenticate("google", { session: false, failureRedirect: "/api/v1/auth/failure" }),
  (req, res) => {
    const user = req.user as User;
    const platform: Platform = req.cookies?.[OAUTH_PLATFORM_COOKIE] === "web" ? "web" : "mobile";
    const mobileRedirectUri = req.cookies?.[OAUTH_MOBILE_REDIRECT_COOKIE] as string | undefined;
    res.clearCookie(OAUTH_STATE_COOKIE);
    res.clearCookie(OAUTH_PLATFORM_COOKIE);
    res.clearCookie(OAUTH_MOBILE_REDIRECT_COOKIE);

    // A single-use, 60s code — not the JWT itself — goes in the redirect URL for both
    // platforms. Mobile needs this because custom URL schemes (myapp://) can be
    // registered by other apps on the device; web doesn't have that specific risk, but
    // keeping the same code-exchange mechanism for both avoids ever putting a long-lived
    // JWT in a URL (browser history, referrer headers, server access logs) and keeps
    // requireAuth's bearer-token model identical across platforms — no cookie/CORS
    // complexity needed on the API side for web (see TRD §4).
    const code = createOneTimeCode(user.id);

    const redirectBase =
      platform === "web"
        ? `${process.env.WEB_APP_URL ?? "http://localhost:3001"}/auth/callback`
        : (mobileRedirectUri ?? process.env.MOBILE_AUTH_REDIRECT_URL ?? "myapp://auth");

    // WEB_APP_URL is free-form server config (unlike MOBILE_AUTH_REDIRECT_URL, which is
    // validated against isAllowedMobileRedirectUri) — a missing "https://" scheme makes
    // `new URL()` throw synchronously, which would otherwise surface as an opaque 500
    // with no indication of what's misconfigured.
    let redirectUrl: URL;
    try {
      redirectUrl = new URL(redirectBase);
    } catch {
      logger.error({ redirectBase, platform }, "OAuth redirect target is not a valid URL — check WEB_APP_URL/MOBILE_AUTH_REDIRECT_URL");
      return res
        .status(500)
        .json({ error: { code: "misconfigured", message: "Server redirect target is misconfigured" } });
    }
    redirectUrl.searchParams.set("code", code);
    res.redirect(redirectUrl.toString());
  }
);

// POST /api/v1/auth/exchange — either client calls this immediately after receiving the
// redirect to trade the one-time code for the actual JWT, over a direct HTTPS request.
authRouter.post("/exchange", (req, res) => {
  const code = req.body?.code as string | undefined;
  if (!code) {
    return res.status(400).json({ error: { code: "bad_request", message: "Missing code" } });
  }

  const userId = consumeOneTimeCode(code);
  if (!userId) {
    return res.status(401).json({ error: { code: "invalid_code", message: "Code is invalid, used, or expired" } });
  }

  res.json({ token: signAuthToken({ userId }) });
});

authRouter.get("/failure", (_req, res) => {
  res.status(401).json({ error: { code: "auth_failed", message: "Google sign-in failed" } });
});

const signupSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

// POST /api/v1/auth/signup — email/password account creation.
// Also "claims" an existing email-only placeholder row created by a business invite
// (see routes/members.ts) — same behavior as the Google flow linking to a placeholder.
authRouter.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "bad_request", message: parsed.error.message } });
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.passwordHash || existing?.googleId) {
    // A real account (either auth method) already owns this email — don't let a signup
    // silently overwrite it. (An email-only invite placeholder, with neither, is fine
    // to claim below.)
    return res.status(409).json({ error: { code: "conflict", message: "An account with this email already exists" } });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data: { name, passwordHash } })
    : await prisma.user.create({ data: { email, name, passwordHash } });

  // Mark any pending invites for this user as joined, same as the Google flow.
  await prisma.businessMember.updateMany({
    where: { userId: user.id, joinedAt: null },
    data: { joinedAt: new Date() },
  });

  res.status(201).json({ token: signAuthToken({ userId: user.id }) });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /api/v1/auth/login — email/password sign-in.
authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "bad_request", message: parsed.error.message } });
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  // Same response whether the email doesn't exist or the password is wrong — never
  // reveal which one it was (standard practice, avoids account enumeration).
  const invalidCredentials = () =>
    res.status(401).json({ error: { code: "invalid_credentials", message: "Invalid email or password" } });

  if (!user?.passwordHash) {
    return invalidCredentials();
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    return invalidCredentials();
  }

  res.json({ token: signAuthToken({ userId: user.id }) });
});
