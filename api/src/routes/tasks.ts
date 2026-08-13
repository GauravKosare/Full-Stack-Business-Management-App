import { Request, Response, Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { createNotification } from "../lib/notifications";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";

export const tasksRouter = Router({ mergeParams: true });
tasksRouter.use(requireAuth);

const taskInclude = {
  assignments: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } },
} as const;

const createTaskSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  dueAt: z.string().datetime().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  recurrenceRule: z.string().optional(),
  assigneeIds: z.array(z.string().uuid()).default([]),
});

// POST /api/v1/businesses/:businessId/tasks — Owner/Manager only
tasksRouter.post("/", requireRole("owner", "manager"), async (req: Request, res: Response) => {
  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "bad_request", message: parsed.error.message } });
  }

  const businessId = req.params.businessId as string;

  const task = await prisma.task.create({
    data: {
      businessId,
      title: parsed.data.title,
      description: parsed.data.description,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : undefined,
      priority: parsed.data.priority,
      recurrenceRule: parsed.data.recurrenceRule,
      createdBy: req.userId!,
      assignments: {
        create: parsed.data.assigneeIds.map((userId) => ({ userId })),
      },
    },
    include: taskInclude,
  });

  await Promise.all(
    parsed.data.assigneeIds.map((userId) =>
      createNotification(userId, businessId, "task_assigned", { taskId: task.id, title: task.title })
    )
  );

  res.status(201).json(task);
});

// GET /api/v1/businesses/:businessId/tasks — any member; employees see only their own by default
tasksRouter.get("/", async (req: Request, res: Response) => {
  const businessId = req.params.businessId as string;

  const membership = await prisma.businessMember.findUnique({
    where: { businessId_userId: { businessId, userId: req.userId! } },
  });

  if (!membership?.joinedAt) {
    return res.status(403).json({ error: { code: "forbidden", message: "Not a member of this business" } });
  }

  const isElevated = membership.role === "owner" || membership.role === "manager";
  const tasks = await prisma.task.findMany({
    where: {
      businessId,
      deletedAt: null,
      ...(isElevated ? {} : { assignments: { some: { userId: req.userId! } } }),
    },
    include: taskInclude,
    orderBy: { createdAt: "desc" },
  });

  res.json(tasks);
});

const updateStatusSchema = z.object({
  status: z.enum(["open", "in_progress", "done", "canceled"]),
});

// PATCH /api/v1/businesses/:businessId/tasks/:taskId/status — assignee or Owner/Manager
tasksRouter.patch("/:taskId/status", async (req: Request, res: Response) => {
  const parsed = updateStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "bad_request", message: parsed.error.message } });
  }

  const businessId = req.params.businessId as string;
  const taskId = req.params.taskId as string;

  const [membership, assignment] = await Promise.all([
    prisma.businessMember.findUnique({
      where: { businessId_userId: { businessId, userId: req.userId! } },
    }),
    prisma.taskAssignment.findUnique({
      where: { taskId_userId: { taskId, userId: req.userId! } },
    }),
  ]);

  const isElevated = membership?.role === "owner" || membership?.role === "manager";
  if (!isElevated && !assignment) {
    return res.status(403).json({ error: { code: "forbidden", message: "Not assigned to this task" } });
  }

  // Scope the update to this business too — without it, a valid taskId belonging to a
  // *different* business would still update, since ids are globally unique (IDOR).
  const { count } = await prisma.task.updateMany({
    where: { id: taskId, businessId },
    data: { status: parsed.data.status },
  });

  if (count === 0) {
    return res.status(404).json({ error: { code: "not_found", message: "Task not found in this business" } });
  }

  if (parsed.data.status === "done" && assignment) {
    await prisma.taskAssignment.update({
      where: { taskId_userId: { taskId, userId: req.userId! } },
      data: { completedAt: new Date() },
    });
  }

  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId }, include: taskInclude });

  res.json(task);
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(5000).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  assigneeIds: z.array(z.string().uuid()).optional(),
});

// PATCH /api/v1/businesses/:businessId/tasks/:taskId — Owner/Manager only. Edits task
// fields and/or fully replaces the assignee set (reassignment).
tasksRouter.patch("/:taskId", requireRole("owner", "manager"), async (req: Request, res: Response) => {
  const parsed = updateTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "bad_request", message: parsed.error.message } });
  }

  const businessId = req.params.businessId as string;
  const taskId = req.params.taskId as string;
  const { assigneeIds, dueAt, ...fields } = parsed.data;

  const existing = await prisma.task.findFirst({ where: { id: taskId, businessId } });
  if (!existing) {
    return res.status(404).json({ error: { code: "not_found", message: "Task not found in this business" } });
  }

  const previousAssigneeIds = new Set(
    (await prisma.taskAssignment.findMany({ where: { taskId }, select: { userId: true } })).map((a) => a.userId)
  );
  const newlyAssignedIds = (assigneeIds ?? []).filter((id) => !previousAssigneeIds.has(id));

  await prisma.$transaction([
    prisma.task.update({
      where: { id: taskId },
      data: { ...fields, ...(dueAt !== undefined ? { dueAt: dueAt ? new Date(dueAt) : null } : {}) },
    }),
    // Reassignment replaces the whole assignee set rather than diffing in place —
    // simpler and correct for this UI (a full picker, not incremental add/remove),
    // at the cost of losing per-assignment completedAt history on reassignment.
    ...(assigneeIds !== undefined
      ? [
          prisma.taskAssignment.deleteMany({ where: { taskId } }),
          prisma.taskAssignment.createMany({ data: assigneeIds.map((userId) => ({ taskId, userId })) }),
        ]
      : []),
  ]);

  await Promise.all(
    newlyAssignedIds.map((userId) =>
      createNotification(userId, businessId, "task_assigned", { taskId, title: fields.title ?? existing.title })
    )
  );

  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId }, include: taskInclude });
  res.json(task);
});
