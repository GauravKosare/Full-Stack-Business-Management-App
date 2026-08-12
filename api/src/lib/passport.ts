import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
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

export { passport };
