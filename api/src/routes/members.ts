import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { createNotification } from "../lib/notifications";
import { sendInviteEmail } from "../lib/brevo";
import { logger } from "../lib/logger";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";

export const membersRouter = Router({ mergeParams: true });
membersRouter.use(requireAuth);

const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200).optional(),
  role: z.enum(["manager", "employee", "client"]),
});

// POST /api/v1/businesses/:businessId/members — invite a member (owner, or manager inviting employees only)
membersRouter.post("/", requireRole("owner", "manager"), async (req, res) => {
  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "bad_request", message: parsed.error.message } });
  }

  const businessId = req.params.businessId as string;

  const [callerMembership, business] = await Promise.all([
    prisma.businessMember.findUnique({
      where: { businessId_userId: { businessId, userId: req.userId! } },
    }),
    prisma.business.findUniqueOrThrow({ where: { id: businessId } }),
  ]);

  if (callerMembership!.role === "manager" && parsed.data.role !== "employee") {
    return res.status(403).json({ error: { code: "forbidden", message: "Managers may only invite employees" } });
  }

  // Placeholder user (no googleId yet) — linked on first Google sign-in by matching email.
  const invitedUser = await prisma.user.upsert({
    where: { email: parsed.data.email },
    update: {},
    create: { email: parsed.data.email, name: parsed.data.name ?? parsed.data.email },
  });

  if (invitedUser.id === business.ownerId) {
    return res.status(400).json({ error: { code: "bad_request", message: "Cannot change the business owner's role via invite" } });
  }

  // update: role is set on every call, not just create — otherwise re-inviting an
  // existing member with a different role silently no-ops and the role never changes.
  const membership = await prisma.businessMember.upsert({
    where: { businessId_userId: { businessId, userId: invitedUser.id } },
    update: { role: parsed.data.role },
    create: {
      businessId,
      userId: invitedUser.id,
      role: parsed.data.role,
    },
  });

  await createNotification(invitedUser.id, businessId, "invite", { businessId, role: parsed.data.role });

  // Must be awaited, not fire-and-forget — Vercel's serverless runtime can freeze the
  // function the instant the response is sent, killing any in-flight promise that isn't
  // awaited first. A failed send still shouldn't fail the invite itself, so errors are
  // caught and logged rather than propagated.
  try {
    await sendInviteEmail({
      toEmail: invitedUser.email,
      toName: invitedUser.name,
      businessName: business.name,
      role: parsed.data.role,
      joinUrl: `${process.env.WEB_APP_URL ?? "http://localhost:3001"}/sign-in`,
    });
  } catch (err) {
    logger.error({ err, email: invitedUser.email }, "Failed to send invite email");
  }

  res.status(201).json(membership);
});

// GET /api/v1/businesses/:businessId/members
membersRouter.get("/", requireRole("owner", "manager"), async (req, res) => {
  const members = await prisma.businessMember.findMany({
    where: { businessId: req.params.businessId as string },
    include: { user: true },
  });

  res.json(members);
});
