import crypto from "node:crypto";
import { Router } from "express";
import { passport } from "../lib/passport";
import { signAuthToken } from "../lib/jwt";
import { createOneTimeCode, consumeOneTimeCode } from "../lib/oauthCodes";
import type { User } from "@prisma/client";

export const authRouter = Router();

const OAUTH_STATE_COOKIE = "oauth_state";

// GET /api/v1/auth/google — sets a random CSRF state in an httpOnly cookie and passes
// the same value through the OAuth redirect; verified against each other on callback.
// (passport-oauth2's own state handling requires a session, which we don't use.)
authRouter.get("/google", (req, res, next) => {
  const state = crypto.randomBytes(16).toString("hex");
  res.cookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 5 * 60 * 1000,
  });
  passport.authenticate("google", { scope: ["profile", "email"], session: false, state })(req, res, next);
});

authRouter.get(
  "/google/callback",
  (req, res, next) => {
    const expectedState = req.cookies?.[OAUTH_STATE_COOKIE];
    res.clearCookie(OAUTH_STATE_COOKIE);
    if (!expectedState || expectedState !== req.query.state) {
      return res.status(401).json({ error: { code: "invalid_state", message: "OAuth state mismatch" } });
    }
    next();
  },
  passport.authenticate("google", { session: false, failureRedirect: "/api/v1/auth/failure" }),
  (req, res) => {
    const user = req.user as User;
    // A single-use, 60s code — not the JWT itself — goes in the redirect URL, since
    // custom URL schemes (myapp://) can be registered by other apps on the device.
    const code = createOneTimeCode(user.id);

    const redirectUrl = new URL(process.env.MOBILE_AUTH_REDIRECT_URL ?? "myapp://auth");
    redirectUrl.searchParams.set("code", code);
    res.redirect(redirectUrl.toString());
  }
);

// POST /api/v1/auth/exchange — mobile app calls this immediately after receiving the
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
