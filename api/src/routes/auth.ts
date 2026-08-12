import crypto from "node:crypto";
import { Router } from "express";
import { passport, isGoogleAuthConfigured } from "../lib/passport";
import { signAuthToken } from "../lib/jwt";
import { createOneTimeCode, consumeOneTimeCode } from "../lib/oauthCodes";
import type { User } from "@prisma/client";

export const authRouter = Router();

const OAUTH_STATE_COOKIE = "oauth_state";
const OAUTH_PLATFORM_COOKIE = "oauth_platform";

type Platform = "mobile" | "web";

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
  const state = crypto.randomBytes(16).toString("hex");

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 5 * 60 * 1000,
  };
  res.cookie(OAUTH_STATE_COOKIE, state, cookieOptions);
  res.cookie(OAUTH_PLATFORM_COOKIE, platform, cookieOptions);

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
      return res.status(401).json({ error: { code: "invalid_state", message: "OAuth state mismatch" } });
    }
    next();
  },
  passport.authenticate("google", { session: false, failureRedirect: "/api/v1/auth/failure" }),
  (req, res) => {
    const user = req.user as User;
    const platform: Platform = req.cookies?.[OAUTH_PLATFORM_COOKIE] === "web" ? "web" : "mobile";
    res.clearCookie(OAUTH_STATE_COOKIE);
    res.clearCookie(OAUTH_PLATFORM_COOKIE);

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
        : (process.env.MOBILE_AUTH_REDIRECT_URL ?? "myapp://auth");

    const redirectUrl = new URL(redirectBase);
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
