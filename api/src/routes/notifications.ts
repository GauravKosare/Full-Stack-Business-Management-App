import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

// GET /api/v1/notifications — current user's notifications across all businesses, newest first
notificationsRouter.get("/", async (req: Request, res: Response) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.userId! },
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
