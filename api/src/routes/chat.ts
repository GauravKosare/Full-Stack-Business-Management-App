import { Request, Response, Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { findOrCreateDirectChannel } from "../lib/channels";
import { broadcastNewMessage } from "../lib/realtime";
import { logger } from "../lib/logger";
import { requireAuth } from "../middleware/requireAuth";

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
        department: m.channel.department,
        // For a direct channel, "otherMembers" is the one other participant — the client
        // uses this to render their name/avatar in place of a channel name.
        otherMembers: m.channel.type === "direct" ? m.channel.members.map((cm) => cm.user) : [],
        lastMessage,
        unreadCount,
      };
    })
  );

  res.json(channels);
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
