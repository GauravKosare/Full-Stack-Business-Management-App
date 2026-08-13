import { Request, Response, Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { createNotification } from "../lib/notifications";
import { STAFF_MANAGING_ROLES, outranks } from "../lib/roles";
import {
  isStorageConfigured,
  ALLOWED_PROOF_MIME_TYPES,
  MAX_PROOF_FILE_BYTES,
  proofObjectPath,
  createProofUploadUrl,
  createProofDownloadUrl,
} from "../lib/storage";
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
  requiresProof: z.boolean().default(false),
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
      requiresProof: parsed.data.requiresProof,
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
  // Only meaningful (and validated) when status is "done" — see the completion-specific
  // checks below. A task created with requiresProof also needs proofPath; without it,
  // just the description.
  completionDescription: z.string().min(1).max(2000).optional(),
  proofPath: z.string().max(500).optional(),
  proofFileName: z.string().max(200).optional(),
  proofFileSize: z.number().int().positive().optional(),
  proofFileType: z.string().max(100).optional(),
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

  const existingTask = await prisma.task.findFirst({ where: { id: taskId, businessId } });
  if (!existingTask) {
    return res.status(404).json({ error: { code: "not_found", message: "Task not found in this business" } });
  }

  // Completing a task always requires a description of how it was done, and — if the
  // task was created with requiresProof — an already-uploaded proof file's storage path.
  // Both are enforced server-side, not just in the completion modal's UI.
  if (parsed.data.status === "done") {
    if (!parsed.data.completionDescription) {
      return res.status(400).json({ error: { code: "bad_request", message: "A completion description is required" } });
    }
    if (existingTask.requiresProof && !parsed.data.proofPath) {
      return res.status(400).json({ error: { code: "bad_request", message: "This task requires a proof document to complete" } });
    }
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

    // Upsert — re-completing a task you'd previously marked done (after it was reopened)
    // replaces the earlier proof rather than colliding with the unique (task, user) index.
    const proofFields = {
      description: parsed.data.completionDescription!,
      filePath: parsed.data.proofPath,
      fileName: parsed.data.proofFileName,
      fileSize: parsed.data.proofFileSize,
      fileType: parsed.data.proofFileType,
    };
    await prisma.taskCompletionProof.upsert({
      where: { taskId_userId: { taskId, userId: req.userId! } },
      update: proofFields,
      create: { taskId, userId: req.userId!, ...proofFields },
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

// POST /api/v1/businesses/:businessId/tasks/:taskId/proof-upload-url — assignee only.
// Returns a short-lived signed URL the browser uploads the file to directly, bypassing
// our own server entirely (and its request-body size limits) — see lib/storage.ts.
tasksRouter.post("/:taskId/proof-upload-url", async (req: Request, res: Response) => {
  if (!isStorageConfigured) {
    return res.status(501).json({ error: { code: "not_configured", message: "File storage is not configured on this server yet" } });
  }

  const fileSchema = z.object({
    fileName: z.string().min(1).max(200),
    fileSize: z.number().int().positive(),
    fileType: z.string().min(1),
  });
  const parsed = fileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "bad_request", message: parsed.error.message } });
  }

  if (parsed.data.fileSize > MAX_PROOF_FILE_BYTES) {
    return res.status(400).json({ error: { code: "bad_request", message: "File must be 5MB or smaller" } });
  }
  if (!ALLOWED_PROOF_MIME_TYPES.has(parsed.data.fileType)) {
    return res.status(400).json({
      error: { code: "bad_request", message: "Unsupported file type — PDF, Word, Excel, text, or image files only (no video)" },
    });
  }

  const businessId = req.params.businessId as string;
  const taskId = req.params.taskId as string;

  const assignment = await prisma.taskAssignment.findUnique({
    where: { taskId_userId: { taskId, userId: req.userId! } },
  });
  if (!assignment) {
    return res.status(403).json({ error: { code: "forbidden", message: "Not assigned to this task" } });
  }

  const path = proofObjectPath(businessId, taskId, req.userId!, parsed.data.fileName);
  const upload = await createProofUploadUrl(path);
  res.json(upload);
});

// GET /api/v1/businesses/:businessId/tasks/:taskId/completion-proof — the task's
// creator, the business owner, or the assignee who completed it can see the proof.
tasksRouter.get("/:taskId/completion-proof", async (req: Request, res: Response) => {
  const businessId = req.params.businessId as string;
  const taskId = req.params.taskId as string;

  const task = await prisma.task.findFirst({ where: { id: taskId, businessId } });
  if (!task) {
    return res.status(404).json({ error: { code: "not_found", message: "Task not found in this business" } });
  }

  const membership = await prisma.businessMember.findUnique({
    where: { businessId_userId: { businessId, userId: req.userId! } },
  });
  const proof = await prisma.taskCompletionProof.findFirst({
    where: { taskId },
    include: { user: { select: { id: true, name: true } } },
  });

  const canView =
    task.createdBy === req.userId! || membership?.role === "owner" || proof?.userId === req.userId!;
  if (!canView) {
    return res.status(403).json({ error: { code: "forbidden", message: "Not authorized to view this proof" } });
  }

  if (!proof) {
    return res.status(404).json({ error: { code: "not_found", message: "No completion proof recorded for this task" } });
  }

  const downloadUrl = proof.filePath && isStorageConfigured ? await createProofDownloadUrl(proof.filePath) : null;

  res.json({
    description: proof.description,
    fileName: proof.fileName,
    fileSize: proof.fileSize,
    completedBy: proof.user,
    createdAt: proof.createdAt,
    downloadUrl,
  });
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(5000).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  assigneeIds: z.array(z.string().uuid()).optional(),
  requiresProof: z.boolean().optional(),
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
