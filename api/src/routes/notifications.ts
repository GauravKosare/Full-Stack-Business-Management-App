import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

// GET /api/v1/notifications?businessId=<id> — current user's notifications, newest
// first. Scoped to one business when businessId is given (the normal case — the web/
// mobile apps always have an active business selected); omitting it falls back to
// every business the caller belongs to, for callers with no business context yet.
notificationsRouter.get("/", async (req: Request, res: Response) => {
  const businessId = typeof req.query.businessId === "string" ? req.query.businessId : undefined;

  const notifications = await prisma.notification.findMany({
    where: { userId: req.userId!, ...(businessId ? { businessId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  res.json(notifications);
});

// PATCH /api/v1/notifications/:id/read
notificationsRouter.patch("/:id/read", async (req: Request, res: Response) => {
  const { count } = await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.userId! },
    data: { readAt: new Date() },
  });

  if (count === 0) {
    return res.status(404).json({ error: { code: "not_found", message: "Notification not found" } });
  }

  res.json({ ok: true });
});

// PATCH /api/v1/notifications/read-all
notificationsRouter.patch("/read-all", async (req: Request, res: Response) => {
  await prisma.notification.updateMany({
    where: { userId: req.userId!, readAt: null },
    data: { readAt: new Date() },
  });

  res.json({ ok: true });
});
