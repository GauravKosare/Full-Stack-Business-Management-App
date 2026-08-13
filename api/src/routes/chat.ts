import { Request, Response, Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { findOrCreateDirectChannel } from "../lib/channels";
import { broadcastNewMessage } from "../lib/realtime";
import { createNotification } from "../lib/notifications";
import { logger } from "../lib/logger";
import { STAFF_MANAGING_ROLES, canAddToChannel } from "../lib/roles";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";

export const chatRouter = Router({ mergeParams: true });
chatRouter.use(requireAuth);

const userSummary = { select: { id: true, name: true, email: true, avatarUrl: true } } as const;

// GET /api/v1/businesses/:businessId/channels — every channel the caller belongs to in
// this business: the company channel, their department channel (if any), and their DMs.
chatRouter.get("/", async (req: Request, res: Response) => {
  const businessId = req.params.businessId as string;

  const memberships = await prisma.channelMember.findMany({
    where: { userId: req.userId!, channel: { businessId } },
    include: {
      channel: {
        include: {
          members: { where: { userId: { not: req.userId! } }, include: { user: userSummary } },
          _count: { select: { messages: true } },
        },
      },
    },
  });

  const channels = await Promise.all(
    memberships.map(async (m) => {
      const lastMessage = await prisma.message.findFirst({
        where: { channelId: m.channelId },
        orderBy: { createdAt: "desc" },
        include: { sender: userSummary },
      });
      const unreadCount = await prisma.message.count({
        where: {
          channelId: m.channelId,
          senderId: { not: req.userId! },
          ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}),
        },
      });

      return {
        id: m.channel.id,
        type: m.channel.type,
        name: m.channel.name,
        description: m.channel.description,
        department: m.channel.department,
        // For direct/custom channels, "otherMembers" is everyone else in it — the
        // client uses this to render participant names in place of/alongside a name.
        otherMembers:
          m.channel.type === "direct" || m.channel.type === "custom"
            ? m.channel.members.map((cm) => cm.user)
            : [],
        lastMessage,
        unreadCount,
      };
    })
  );

  res.json(channels);
});

// GET /api/v1/businesses/:businessId/channels/assignable-members — who the caller could
// add to a channel they create (see canAddToChannel: same rank, below, or one rank
// above). Deliberately not filtered by the Team page's department-visibility rule —
// channel membership is a rank question, not a department one.
chatRouter.get("/assignable-members", requireRole(...STAFF_MANAGING_ROLES), async (req: Request, res: Response) => {
  const businessId = req.params.businessId as string;

  const caller = await prisma.businessMember.findUniqueOrThrow({
    where: { businessId_userId: { businessId, userId: req.userId! } },
  });

  const members = await prisma.businessMember.findMany({
    where: { businessId, joinedAt: { not: null }, userId: { not: req.userId! } },
    include: { user: userSummary },
  });

  res.json(members.filter((m) => canAddToChannel(caller.role, m.role)).map((m) => m.user));
});

const startDirectSchema = z.object({ userId: z.string().uuid() });

// POST /api/v1/businesses/:businessId/channels/direct — get-or-create a DM with another
// member of the same business.
chatRouter.post("/direct", async (req: Request, res: Response) => {
  const parsed = startDirectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "bad_request", message: parsed.error.message } });
  }
  if (parsed.data.userId === req.userId) {
    return res.status(400).json({ error: { code: "bad_request", message: "Cannot start a DM with yourself" } });
  }

  const businessId = req.params.businessId as string;

  const [callerMembership, targetMembership] = await Promise.all([
    prisma.businessMember.findUnique({ where: { businessId_userId: { businessId, userId: req.userId! } } }),
    prisma.businessMember.findUnique({ where: { businessId_userId: { businessId, userId: parsed.data.userId } } }),
  ]);

  if (!callerMembership?.joinedAt || !targetMembership?.joinedAt) {
    return res.status(403).json({ error: { code: "forbidden", message: "Both people must be members of this business" } });
  }

  const channel = await findOrCreateDirectChannel(businessId, req.userId!, parsed.data.userId);
  res.status(201).json({ id: channel.id, type: channel.type });
});

const createChannelSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  department: z.string().max(100).optional(),
  memberIds: z.array(z.string().uuid()).default([]),
});

// POST /api/v1/businesses/:businessId/channels — create a custom channel. Any
// staff-managing role (everyone but Employee) can create one, but may only add people
// at their own rank, below it, or exactly one rank above (see canAddToChannel) —
// deliberately more permissive than invites/task assignment, which never allow adding
// upward at all.
chatRouter.post("/", requireRole(...STAFF_MANAGING_ROLES), async (req: Request, res: Response) => {
  const parsed = createChannelSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "bad_request", message: parsed.error.message } });
  }

  const businessId = req.params.businessId as string;

  const creatorMembership = await prisma.businessMember.findUniqueOrThrow({
    where: { businessId_userId: { businessId, userId: req.userId! } },
  });

  const memberIds = [...new Set(parsed.data.memberIds.filter((id) => id !== req.userId))];
  if (memberIds.length > 0) {
    const memberships = await prisma.businessMember.findMany({
      where: { businessId, userId: { in: memberIds }, joinedAt: { not: null } },
      select: { userId: true, role: true },
    });
    for (const id of memberIds) {
      const membership = memberships.find((m) => m.userId === id);
      if (!membership || !canAddToChannel(creatorMembership.role, membership.role)) {
        return res.status(403).json({
          error: {
            code: "forbidden",
            message: "You can only add people at your rank, below it, or one rank above",
          },
        });
      }
    }
  }

  const channel = await prisma.channel.create({
    data: {
      businessId,
      type: "custom",
      name: parsed.data.name,
      description: parsed.data.description,
      department: parsed.data.department,
      createdBy: req.userId!,
      members: { create: [{ userId: req.userId! }, ...memberIds.map((userId) => ({ userId }))] },
    },
  });

  await Promise.all(
    memberIds.map((userId) =>
      createNotification(userId, businessId, "channel_invite", { channelId: channel.id, channelName: channel.name })
    )
  );

  res.status(201).json({ id: channel.id, type: channel.type });
});

// GET /api/v1/businesses/:businessId/channels/:channelId/messages?before=<ISO date>
chatRouter.get("/:channelId/messages", async (req: Request, res: Response) => {
  const channelId = req.params.channelId as string;

  const membership = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId: req.userId! } },
  });
  if (!membership) {
    return res.status(403).json({ error: { code: "forbidden", message: "Not a member of this channel" } });
  }

  const before = typeof req.query.before === "string" ? new Date(req.query.before) : undefined;

  const messages = await prisma.message.findMany({
    where: { channelId, ...(before ? { createdAt: { lt: before } } : {}) },
    include: { sender: userSummary },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  res.json(messages.reverse());
});

const sendMessageSchema = z.object({ body: z.string().min(1).max(4000) });

// POST /api/v1/businesses/:businessId/channels/:channelId/messages
chatRouter.post("/:channelId/messages", async (req: Request, res: Response) => {
  const parsed = sendMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "bad_request", message: parsed.error.message } });
  }

  const channelId = req.params.channelId as string;

  const membership = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId: req.userId! } },
  });
  if (!membership) {
    return res.status(403).json({ error: { code: "forbidden", message: "Not a member of this channel" } });
  }

  const message = await prisma.message.create({
    data: { channelId, senderId: req.userId!, body: parsed.data.body },
    include: { sender: userSummary },
  });

  await prisma.channelMember.update({
    where: { channelId_userId: { channelId, userId: req.userId! } },
    data: { lastReadAt: new Date() },
  });

  try {
    await broadcastNewMessage(channelId, message);
  } catch (err) {
    logger.error({ err, channelId }, "Failed to broadcast new message");
  }

  res.status(201).json(message);
});

// PATCH /api/v1/businesses/:businessId/channels/:channelId/read — mark caught up, for
// the unread-count badge.
chatRouter.patch("/:channelId/read", async (req: Request, res: Response) => {
  const channelId = req.params.channelId as string;

  const { count } = await prisma.channelMember.updateMany({
    where: { channelId, userId: req.userId! },
    data: { lastReadAt: new Date() },
  });

  if (count === 0) {
    return res.status(403).json({ error: { code: "forbidden", message: "Not a member of this channel" } });
  }

  res.json({ ok: true });
});
