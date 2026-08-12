import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { logger } from "./logger";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

export const isGoogleAuthConfigured = Boolean(googleClientId && googleClientSecret);

// passport-google-oauth20 throws synchronously if clientID/clientSecret are missing,
// which would crash the whole process at import time (including on every route, not
// just auth) before Google env vars are configured — e.g. right after a fresh deploy.
// Skip registering the strategy instead, and let /auth/google 501 until it's configured.
if (googleClientId && googleClientSecret) {
  passport.use(
  new GoogleStrategy(
    {
      clientID: googleClientId,
      clientSecret: googleClientSecret,
      callbackURL: process.env.GOOGLE_CALLBACK_URL ?? "/api/v1/auth/google/callback",
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error("Google profile has no email"));
        }

        const googleProfileData = {
          googleId: profile.id,
          name: profile.displayName,
          avatarUrl: profile.photos?.[0]?.value,
          // If this email previously signed up with a password (unverified — we don't
          // send verification emails yet), invalidate that password now that Google has
          // actually verified ownership of the address. Otherwise anyone who registered
          // this email/password first (before the real owner ever used it) could keep
          // logging in as this account indefinitely after the real owner starts using
          // Google — Google verification should be the stronger, superseding signal.
          passwordHash: null,
        };

        // A user may already exist as an email-only placeholder created by an invite
        // (see routes/members.ts) before ever signing in — link it by googleId on first login.
        const existingByGoogleId = await prisma.user.findUnique({ where: { googleId: profile.id } });
        const existingByEmail = existingByGoogleId ?? (await prisma.user.findUnique({ where: { email } }));

        let user;
        if (existingByEmail) {
          user = await prisma.user.update({ where: { id: existingByEmail.id }, data: googleProfileData });
        } else {
          try {
            user = await prisma.user.create({ data: { ...googleProfileData, email } });
          } catch (err) {
            // Two concurrent first-time logins for the same email can both miss the
            // findUnique above; the loser hits the unique constraint on `email` here —
            // recover by linking to the row the winner just created instead of failing.
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
              const raceWinner = await prisma.user.findUniqueOrThrow({ where: { email } });
              user = await prisma.user.update({ where: { id: raceWinner.id }, data: googleProfileData });
            } else {
              throw err;
            }
          }
        }

        // Mark any pending invites for this user as joined (invitedAt set, joinedAt null).
        await prisma.businessMember.updateMany({
          where: { userId: user.id, joinedAt: null },
          data: { joinedAt: new Date() },
        });

        done(null, user);
      } catch (err) {
        done(err as Error);
      }
    }
  )
  );
} else {
  logger.warn("GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET not set — Google sign-in routes are disabled until configured");
}

export { passport };
