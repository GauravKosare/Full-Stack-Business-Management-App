import { Request, Response, Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { createNotification } from "../lib/notifications";
import { STAFF_MANAGING_ROLES, outranks } from "../lib/roles";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";

export const tasksRouter = Router({ mergeParams: true });
tasksRouter.use(requireAuth);

const taskInclude = {
  assignments: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } },
} as const;

// A task's assignees must each be strictly below the assigner's own rank — matching the
// same delegation rule as invites (src/lib/roles.ts) — except assigning to yourself,
// which is always allowed regardless of rank.
async function invalidAssigneeReason(
  businessId: string,
  actorId: string,
  actorRole: Role,
  assigneeIds: string[]
): Promise<string | null> {
  const others = assigneeIds.filter((id) => id !== actorId);
  if (others.length === 0) return null;

  const memberships = await prisma.businessMember.findMany({
    where: { businessId, userId: { in: others } },
    select: { userId: true, role: true },
  });

  for (const id of others) {
    const membership = memberships.find((m) => m.userId === id);
    if (!membership || !outranks(actorRole, membership.role)) {
      return "You can only assign tasks to people ranked below you";
    }
  }
  return null;
}

const createTaskSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  dueAt: z.string().datetime().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  recurrenceRule: z.string().optional(),
  assigneeIds: z.array(z.string().uuid()).default([]),
});

// POST /api/v1/businesses/:businessId/tasks — any staff-managing role (everyone but
// Employee) may create tasks, but only for people they outrank (see invalidAssigneeReason).
tasksRouter.post("/", requireRole(...STAFF_MANAGING_ROLES), async (req: Request, res: Response) => {
  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "bad_request", message: parsed.error.message } });
  }

  const businessId = req.params.businessId as string;

  const membership = await prisma.businessMember.findUniqueOrThrow({
    where: { businessId_userId: { businessId, userId: req.userId! } },
  });
  const reason = await invalidAssigneeReason(businessId, req.userId!, membership.role, parsed.data.assigneeIds);
  if (reason) {
    return res.status(403).json({ error: { code: "forbidden", message: reason } });
  }

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

// GET /api/v1/businesses/:businessId/tasks — a task is only visible to whoever created
// it and whoever it's assigned to (its "associated people"), not the whole business.
// The business owner is the one exception — kept for overall oversight (dashboard,
// workload view) rather than leaving the account owner blind to their own business.
tasksRouter.get("/", async (req: Request, res: Response) => {
  const businessId = req.params.businessId as string;

  const membership = await prisma.businessMember.findUnique({
    where: { businessId_userId: { businessId, userId: req.userId! } },
  });

  if (!membership?.joinedAt) {
    return res.status(403).json({ error: { code: "forbidden", message: "Not a member of this business" } });
  }

  const seesEverything = membership.role === "owner";
  const tasks = await prisma.task.findMany({
    where: {
      businessId,
      deletedAt: null,
      ...(seesEverything
        ? {}
        : { OR: [{ createdBy: req.userId! }, { assignments: { some: { userId: req.userId! } } }] }),
    },
    include: taskInclude,
    orderBy: { createdAt: "desc" },
  });

  res.json(tasks);
});

const updateStatusSchema = z.object({
  status: z.enum(["open", "in_progress", "done", "canceled"]),
});

// PATCH /api/v1/businesses/:businessId/tasks/:taskId/status — assignee only. Deliberately
// not open to owner/manager: moving a task on the board reflects the assignee's own
// progress, and only they should be able to report it.
tasksRouter.patch("/:taskId/status", async (req: Request, res: Response) => {
  const parsed = updateStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "bad_request", message: parsed.error.message } });
  }

  const businessId = req.params.businessId as string;
  const taskId = req.params.taskId as string;

  const assignment = await prisma.taskAssignment.findUnique({
    where: { taskId_userId: { taskId, userId: req.userId! } },
  });

  if (!assignment) {
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

  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });

  if (parsed.data.status === "done") {
    await prisma.taskAssignment.update({
      where: { taskId_userId: { taskId, userId: req.userId! } },
      data: { completedAt: new Date() },
    });

    const onTime = !task.dueAt || new Date() <= task.dueAt;
    await createNotification(task.createdBy, businessId, "task_completed", {
      taskId,
      title: task.title,
      onTime,
      completedBy: req.userId!,
    });
  }

  const enriched = await prisma.task.findUniqueOrThrow({ where: { id: taskId }, include: taskInclude });

  res.json(enriched);
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(5000).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  assigneeIds: z.array(z.string().uuid()).optional(),
});

// PATCH /api/v1/businesses/:businessId/tasks/:taskId — the task's own creator, or the
// business owner, not any manager — editing/reassigning is an authoring action tied to
// who made the task, matching the same "associated people" rule as visibility above.
tasksRouter.patch("/:taskId", async (req: Request, res: Response) => {
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

  const membership = await prisma.businessMember.findUnique({
    where: { businessId_userId: { businessId, userId: req.userId! } },
  });
  const canEdit = existing.createdBy === req.userId! || membership?.role === "owner";
  if (!canEdit) {
    return res.status(403).json({ error: { code: "forbidden", message: "Only the task's creator or the business owner can edit it" } });
  }

  if (assigneeIds !== undefined && membership) {
    const reason = await invalidAssigneeReason(businessId, req.userId!, membership.role, assigneeIds);
    if (reason) {
      return res.status(403).json({ error: { code: "forbidden", message: reason } });
    }
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
