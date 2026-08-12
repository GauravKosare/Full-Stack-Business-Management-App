import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";

/**
 * Rates are computed live from task_assignments rather than via a scheduled nightly
 * job — there's no persistent process to run one on serverless (Vercel), and computing
 * on demand is cheap at MVP scale. Matches the schema doc: task_completion_rate/
 * on_time_rate on performance_reviews are a snapshot taken at review-creation time,
 * not a continuously-updated cached value.
 */
async function computeRates(businessId: string, employeeId: string) {
  const assignments = await prisma.taskAssignment.findMany({
    where: { userId: employeeId, task: { businessId, deletedAt: null } },
    include: { task: true },
  });

  const relevant = assignments.filter((a) => a.task.status !== "canceled");
  const completed = relevant.filter((a) => a.task.status === "done");
  const taskCompletionRate = relevant.length ? (completed.length / relevant.length) * 100 : 0;

  const completedWithDue = completed.filter((a) => a.task.dueAt);
  const onTime = completedWithDue.filter(
    (a) => a.completedAt && a.task.dueAt && a.completedAt <= a.task.dueAt
  );
  const onTimeRate = completedWithDue.length ? (onTime.length / completedWithDue.length) * 100 : 0;

  return {
    taskCompletionRate: Number(taskCompletionRate.toFixed(2)),
    onTimeRate: Number(onTimeRate.toFixed(2)),
  };
}

async function getMembership(businessId: string, userId: string) {
  return prisma.businessMember.findUnique({
    where: { businessId_userId: { businessId, userId } },
  });
}

// GET /api/v1/businesses/:businessId/performance/:employeeId — live rates.
// Owner/Manager can view anyone; an employee can only view their own.
export const performanceRouter = Router({ mergeParams: true });
performanceRouter.use(requireAuth);

performanceRouter.get("/:employeeId", async (req: Request, res: Response) => {
  const businessId = req.params.businessId as string;
  const employeeId = req.params.employeeId as string;

  const membership = await getMembership(businessId, req.userId!);
  if (!membership?.joinedAt) {
    return res.status(403).json({ error: { code: "forbidden", message: "Not a member of this business" } });
  }

  const isElevated = membership.role === "owner" || membership.role === "manager";
  if (!isElevated && req.userId !== employeeId) {
    return res
      .status(403)
      .json({ error: { code: "forbidden", message: "Cannot view another employee's performance" } });
  }

  res.json(await computeRates(businessId, employeeId));
});

// /api/v1/businesses/:businessId/performance-reviews
export const performanceReviewsRouter = Router({ mergeParams: true });
performanceReviewsRouter.use(requireAuth);

const createReviewSchema = z.object({
  employeeId: z.string().uuid(),
  periodStart: z.string().date(),
  periodEnd: z.string().date(),
  rating: z.number().int().min(1).max(5),
  notes: z.string().max(5000).optional(),
});

// POST /api/v1/businesses/:businessId/performance-reviews — Owner/Manager only.
// Snapshots the current computed rates into the review at creation time.
performanceReviewsRouter.post("/", requireRole("owner", "manager"), async (req: Request, res: Response) => {
  const parsed = createReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "bad_request", message: parsed.error.message } });
  }

  const businessId = req.params.businessId as string;

  const targetMembership = await getMembership(businessId, parsed.data.employeeId);
  if (!targetMembership?.joinedAt) {
    return res
      .status(400)
      .json({ error: { code: "bad_request", message: "employeeId is not a member of this business" } });
  }

  const rates = await computeRates(businessId, parsed.data.employeeId);

  const review = await prisma.performanceReview.create({
    data: {
      businessId,
      employeeId: parsed.data.employeeId,
      reviewerId: req.userId!,
      periodStart: new Date(parsed.data.periodStart),
      periodEnd: new Date(parsed.data.periodEnd),
      rating: parsed.data.rating,
      notes: parsed.data.notes,
      taskCompletionRate: rates.taskCompletionRate,
      onTimeRate: rates.onTimeRate,
    },
  });

  res.status(201).json(review);
});

// GET /api/v1/businesses/:businessId/performance-reviews?employeeId=
// Owner/Manager see any employee's history (or all, if employeeId omitted);
// an employee only ever sees their own.
performanceReviewsRouter.get("/", async (req: Request, res: Response) => {
  const businessId = req.params.businessId as string;
  const membership = await getMembership(businessId, req.userId!);
  if (!membership?.joinedAt) {
    return res.status(403).json({ error: { code: "forbidden", message: "Not a member of this business" } });
  }

  const isElevated = membership.role === "owner" || membership.role === "manager";
  const requestedEmployeeId = req.query.employeeId as string | undefined;

  if (!isElevated && requestedEmployeeId && requestedEmployeeId !== req.userId) {
    return res
      .status(403)
      .json({ error: { code: "forbidden", message: "Cannot view another employee's reviews" } });
  }

  const employeeId = isElevated ? requestedEmployeeId : req.userId!;

  const reviews = await prisma.performanceReview.findMany({
    where: { businessId, ...(employeeId ? { employeeId } : {}) },
    orderBy: { createdAt: "desc" },
  });

  res.json(reviews);
});
