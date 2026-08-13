import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { createNotification } from "../lib/notifications";
import { sendInviteEmail } from "../lib/brevo";
import { logger } from "../lib/logger";
import { STAFF_MANAGING_ROLES, PEER_VISIBILITY_ROLES, ROLE_LABELS, outranks } from "../lib/roles";
import { syncChannelMembership } from "../lib/channels";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";

export const membersRouter = Router({ mergeParams: true });
membersRouter.use(requireAuth);

const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200).optional(),
  role: z.enum(["director", "manager", "project_head", "employee"]),
  department: z.string().max(100).optional(),
});

// POST /api/v1/businesses/:businessId/members — invite (or re-invite, changing role/
// department) a member. Every staff-managing role may invite, but only into a role
// strictly below its own — enforced below, not by requireRole, since that only knows
// the caller's own role, not the hierarchy relationship to the target role.
membersRouter.post("/", requireRole(...STAFF_MANAGING_ROLES), async (req, res) => {
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

  if (!outranks(callerMembership!.role, parsed.data.role)) {
    return res.status(403).json({
      error: {
        code: "forbidden",
        message: `${ROLE_LABELS[callerMembership!.role]}s may only invite roles below their own`,
      },
    });
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

  // Re-inviting an existing member doubles as "edit their role" — so the caller must
  // also outrank the member's *current* role, not just the requested new one. Without
  // this, a Manager could "re-invite" a Director down to Employee, since outranking the
  // requested target role (employee) alone isn't the same as being allowed to touch a
  // Director at all.
  const existingMembership = await prisma.businessMember.findUnique({
    where: { businessId_userId: { businessId, userId: invitedUser.id } },
  });
  if (existingMembership && !outranks(callerMembership!.role, existingMembership.role)) {
    return res.status(403).json({
      error: { code: "forbidden", message: "You cannot change the role of someone at or above your own rank" },
    });
  }

  // update: role/department are set on every call, not just create — otherwise
  // re-inviting an existing member with a different role silently no-ops and the role
  // never changes. This doubles as the "edit an existing member's role" mechanism —
  // there's no separate endpoint for that.
  const membership = await prisma.businessMember.upsert({
    where: { businessId_userId: { businessId, userId: invitedUser.id } },
    update: { role: parsed.data.role, department: parsed.data.department },
    create: {
      businessId,
      userId: invitedUser.id,
      role: parsed.data.role,
      department: parsed.data.department,
    },
  });

  // Already-joined member being edited (not a fresh placeholder) — their channel
  // membership needs to move immediately if their department just changed. A fresh
  // placeholder has no channel membership yet; that's set up when they actually join
  // (see syncAllChannelMembershipsForUser in auth.ts/passport.ts).
  if (existingMembership?.joinedAt) {
    await syncChannelMembership(businessId, invitedUser.id, parsed.data.department ?? null);
  }

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

// GET /api/v1/businesses/:businessId/members — Owner sees everyone. Everyone else
// (Director/Manager/Project Head) sees: people in their own department (any rank), plus
// — for Director/Manager, "manager and above" — same-rank peers company-wide regardless
// of department. Matches the same associated-people philosophy as task visibility.
membersRouter.get("/", requireRole(...STAFF_MANAGING_ROLES), async (req: Request, res: Response) => {
  const businessId = req.params.businessId as string;

  const viewer = await prisma.businessMember.findUniqueOrThrow({
    where: { businessId_userId: { businessId, userId: req.userId! } },
  });

  const seesEverything = viewer.role === "owner";

  const members = await prisma.businessMember.findMany({
    where: {
      businessId,
      ...(seesEverything
        ? {}
        : {
            OR: [
              { userId: req.userId! },
              ...(viewer.department ? [{ department: viewer.department }] : []),
              ...(PEER_VISIBILITY_ROLES.includes(viewer.role) ? [{ role: viewer.role }] : []),
            ],
          }),
    },
    include: { user: true },
  });

  res.json(members);
});

// GET /api/v1/businesses/:businessId/members/directory — any joined member (not just
// staff-managing roles) can see who else is in the business, name/avatar only — used to
// start a DM. Role/department stay behind the GET / above.
membersRouter.get("/directory", async (req: Request, res: Response) => {
  const businessId = req.params.businessId as string;

  const membership = await prisma.businessMember.findUnique({
    where: { businessId_userId: { businessId, userId: req.userId! } },
  });
  if (!membership?.joinedAt) {
    return res.status(403).json({ error: { code: "forbidden", message: "Not a member of this business" } });
  }

  const members = await prisma.businessMember.findMany({
    where: { businessId, joinedAt: { not: null }, userId: { not: req.userId! } },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });

  res.json(members.map((m) => m.user));
});
