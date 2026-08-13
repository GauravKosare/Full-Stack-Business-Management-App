import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { syncChannelMembership } from "../lib/channels";
import { requireAuth } from "../middleware/requireAuth";

export const businessesRouter = Router();
businessesRouter.use(requireAuth);

const createBusinessSchema = z.object({
  name: z.string().min(1).max(200),
});

// POST /api/v1/businesses — create a business; caller becomes owner
businessesRouter.post("/", async (req, res) => {
  const parsed = createBusinessSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "bad_request", message: parsed.error.message } });
  }

  const business = await prisma.business.create({
    data: {
      name: parsed.data.name,
      ownerId: req.userId!,
      members: {
        create: { userId: req.userId!, role: "owner", joinedAt: new Date() },
      },
    },
  });

  await syncChannelMembership(business.id, req.userId!, null);

  res.status(201).json(business);
});

// GET /api/v1/businesses — list businesses the caller belongs to
businessesRouter.get("/", async (req, res) => {
  const memberships = await prisma.businessMember.findMany({
    where: { userId: req.userId!, joinedAt: { not: null } },
    include: { business: true },
  });

  res.json(memberships.map((m) => ({ ...m.business, role: m.role })));
});

// GET /api/v1/businesses/:businessId
businessesRouter.get("/:businessId", async (req, res) => {
  const membership = await prisma.businessMember.findUnique({
    where: { businessId_userId: { businessId: req.params.businessId, userId: req.userId! } },
    include: { business: true },
  });

  if (!membership || !membership.joinedAt) {
    return res.status(404).json({ error: { code: "not_found", message: "Business not found" } });
  }

  res.json({ ...membership.business, role: membership.role });
});
