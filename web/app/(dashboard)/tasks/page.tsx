"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { getActiveBusinessId, getActiveBusinessRole } from "@/lib/business";
import { isStaffManaging, outranks } from "@/lib/roles";
import { supabase } from "@/lib/supabase";
import { ErrorState } from "../ErrorState";

interface Member {
  id: string;
  role: string;
  joinedAt: string | null;
  user: { id: string; name: string; email: string; avatarUrl: string | null };
}

interface AssignmentUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

interface Assignment {
  id: string;
  userId: string;
  completedAt: string | null;
  user: AssignmentUser;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: "open" | "in_progress" | "done" | "canceled";
  priority: "low" | "medium" | "high";
  dueAt: string | null;
  createdBy: string;
  requiresProof: boolean;
  assignments: Assignment[];
}

interface Me {
  id: string;
}

const COLUMNS: { status: Task["status"]; label: string }[] = [
  { status: "open", label: "Open" },
  { status: "in_progress", label: "In Progress" },
  { status: "done", label: "Done" },
];

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-warning/10 text-warning",
  high: "bg-danger/10 text-danger",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [dragOverStatus, setDragOverStatus] = useState<Task["status"] | null>(null);
  const [completingTask, setCompletingTask] = useState<Task | null>(null);

  const businessId = getActiveBusinessId();
  const role = getActiveBusinessRole();
  const isElevated = isStaffManaging(role);

  // Only members the current user actually outranks (or themself) are valid assignees —
  // matches the server-side rule in api/src/routes/tasks.ts's invalidAssigneeReason.
  const assignableMembers = members.filter((m) => m.user.id === me?.id || outranks(role, m.role));

  function isAssignee(task: Task) {
    return me !== null && task.assignments.some((a) => a.userId === me.id);
  }

  function canEditTask(task: Task) {
    return me !== null && (task.createdBy === me.id || role === "owner");
  }

  function load() {
    if (!businessId) return;
    const requests: Promise<unknown>[] = [
      apiFetch<Task[]>(`/api/v1/businesses/${businessId}/tasks`).then(setTasks),
      apiFetch<Me>("/api/v1/auth/me").then(setMe),
    ];
    if (isElevated) {
      requests.push(apiFetch<Member[]>(`/api/v1/businesses/${businessId}/members`).then(setMembers));
    }
    Promise.all(requests)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load tasks"))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [businessId]);

  async function updateStatus(taskId: string, status: Task["status"]) {
    if (!businessId) return;
    const previous = tasks;
    setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, status } : t)));
    try {
      await apiFetch(`/api/v1/businesses/${businessId}/tasks/${taskId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
    } catch (err) {
      setTasks(previous);
      setError(err instanceof ApiError ? err.message : "Failed to move task");
    }
  }

  function onDrop(status: Task["status"], e: React.DragEvent) {
    e.preventDefault();
    setDragOverStatus(null);
    const taskId = e.dataTransfer.getData("text/plain");
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === status || !isAssignee(task)) return;
    // Completing a task always asks how it was done — and for a proof document too, if
    // the task was created requiring one — so "done" opens that modal instead of moving
    // the card immediately.
    if (status === "done") {
      setCompletingTask(task);
    } else {
      updateStatus(taskId, status);
    }
  }

  const workload = useMemo(() => {
    const counts = new Map<string, { name: string; avatarUrl: string | null; open: number }>();
    for (const m of members) {
      counts.set(m.user.id, { name: m.user.name, avatarUrl: m.user.avatarUrl, open: 0 });
    }
    for (const t of tasks) {
      if (t.status === "done" || t.status === "canceled") continue;
      for (const a of t.assignments) {
        const entry = counts.get(a.userId) ?? { name: a.user.name, avatarUrl: a.user.avatarUrl, open: 0 };
        entry.open += 1;
        counts.set(a.userId, entry);
      }
    }
    return [...counts.values()].sort((a, b) => b.open - a.open);
  }, [tasks, members]);

  const maxWorkload = Math.max(1, ...workload.map((w) => w.open));

  if (loading) return <p className="text-gray-500">Loading…</p>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Tasks</h1>
        {isElevated && (
          <button
            onClick={() => setCreating(true)}
            className="rounded-card bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            + New task
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4">
          <ErrorState message={error} />
        </div>
      )}

      <div className="flex gap-6">
        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-3">
          {COLUMNS.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.status);
            return (
              <div
                key={col.status}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverStatus(col.status);
                }}
                onDragLeave={() => setDragOverStatus(null)}
                onDrop={(e) => onDrop(col.status, e)}
                className={`rounded-card border p-3 transition-colors ${
                  dragOverStatus === col.status ? "border-primary bg-blue-50" : "border-gray-200 bg-gray-50"
                }`}
              >
                <div className="mb-3 flex items-center justify-between px-1">
                  <h2 className="text-sm font-semibold text-gray-700">{col.label}</h2>
                  <span className="text-xs text-gray-400">{colTasks.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {colTasks.map((task) => {
                    const draggableByMe = isAssignee(task);
                    const editableByMe = canEditTask(task);
                    return (
                    <div
                      key={task.id}
                      draggable={draggableByMe}
                      onDragStart={(e) => draggableByMe && e.dataTransfer.setData("text/plain", task.id)}
                      onClick={() => editableByMe && setEditingTask(task)}
                      title={
                        !draggableByMe && !editableByMe
                          ? "You're not assigned to or the creator of this task"
                          : undefined
                      }
                      className={`rounded-card border border-gray-200 bg-white p-3 shadow-sm ${
                        editableByMe ? "cursor-pointer hover:border-primary" : draggableByMe ? "cursor-grab" : ""
                      }`}
                    >
                      <p className="text-sm font-medium text-gray-900">{task.title}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className={`rounded-pill px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[task.priority]}`}>
                          {task.priority}
                        </span>
                        {task.dueAt && (
                          <span className="text-xs text-gray-400">{new Date(task.dueAt).toLocaleDateString()}</span>
                        )}
                      </div>
                      {task.assignments.length > 0 && (
                        <div className="mt-2 flex -space-x-1">
                          {task.assignments.map((a) => (
                            <span
                              key={a.id}
                              title={a.user.name}
                              className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-primary text-[10px] font-medium text-white"
                            >
                              {initials(a.user.name)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    );
                  })}
                  {colTasks.length === 0 && <p className="px-1 py-4 text-center text-xs text-gray-400">No tasks</p>}
                </div>
              </div>
            );
          })}
        </div>

        {isElevated && (
          <div className="w-64 shrink-0">
            <h2 className="mb-3 text-sm font-semibold text-gray-700">Workload</h2>
            <div className="flex flex-col gap-3 rounded-card border border-gray-200 bg-white p-4">
              {workload.length === 0 && <p className="text-xs text-gray-400">No team members yet</p>}
              {workload.map((w) => (
                <div key={w.name}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-700">{w.name}</span>
                    <span className="text-gray-400">{w.open} open</span>
                  </div>
                  <div className="h-2 rounded-pill bg-gray-100">
                    <div
                      className="h-2 rounded-pill bg-primary"
                      style={{ width: `${(w.open / maxWorkload) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {creating && (
        <TaskFormModal
          members={assignableMembers}
          onClose={() => setCreating(false)}
          onSubmit={async (data) => {
            if (!businessId) return;
            await apiFetch(`/api/v1/businesses/${businessId}/tasks`, {
              method: "POST",
              body: JSON.stringify(data),
            });
            setCreating(false);
            load();
          }}
        />
      )}

      {editingTask && (
        <TaskFormModal
          members={assignableMembers}
          initial={editingTask}
          onClose={() => setEditingTask(null)}
          onSubmit={async (data) => {
            if (!businessId) return;
            await apiFetch(`/api/v1/businesses/${businessId}/tasks/${editingTask.id}`, {
              method: "PATCH",
              body: JSON.stringify(data),
            });
            setEditingTask(null);
            load();
          }}
        />
      )}

      {completingTask && businessId && (
        <CompleteTaskModal
          task={completingTask}
          businessId={businessId}
          onClose={() => setCompletingTask(null)}
          onDone={() => {
            setCompletingTask(null);
            load();
          }}
        />
      )}
    </div>
  );
}

interface TaskFormData {
  title: string;
  description?: string;
  priority: string;
  dueAt?: string | null;
  assigneeIds: string[];
  requiresProof: boolean;
}

function TaskFormModal({
  members,
  initial,
  onClose,
  onSubmit,
}: {
  members: Member[];
  initial?: Task;
  onClose: () => void;
  onSubmit: (data: TaskFormData) => Promise<void>;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [priority, setPriority] = useState<string>(initial?.priority ?? "medium");
  const [dueAt, setDueAt] = useState(initial?.dueAt ? initial.dueAt.slice(0, 10) : "");
  const [assigneeIds, setAssigneeIds] = useState<string[]>(initial?.assignments.map((a) => a.userId) ?? []);
  const [requiresProof, setRequiresProof] = useState(initial?.requiresProof ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleAssignee(userId: string) {
    setAssigneeIds((ids) => (ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        title,
        description: description || undefined,
        priority,
        dueAt: dueAt ? new Date(dueAt).toISOString() : initial ? null : undefined,
        assigneeIds,
        requiresProof,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save task");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-card border border-gray-200 bg-white p-6 shadow-lg"
      >
        <h2 className="mb-4 text-lg font-semibold text-gray-900">{initial ? "Edit task" : "New task"}</h2>

        <div className="flex flex-col gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            required
            className="rounded-card border border-gray-300 px-3 py-2 text-sm"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={3}
            className="rounded-card border border-gray-300 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="flex-1 rounded-card border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="low">Low priority</option>
              <option value="medium">Medium priority</option>
              <option value="high">High priority</option>
            </select>
            <input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="flex-1 rounded-card border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={requiresProof}
              onChange={(e) => setRequiresProof(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Require a proof document when marking this task done
          </label>

          {members.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase text-gray-400">Assignees</p>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => (
                  <label
                    key={m.user.id}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-pill border px-2.5 py-1 text-xs ${
                      assigneeIds.includes(m.user.id)
                        ? "border-primary bg-blue-50 text-primary"
                        : "border-gray-300 text-gray-600"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={assigneeIds.includes(m.user.id)}
                      onChange={() => toggleAssignee(m.user.id)}
                    />
                    {m.user.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-card border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-card bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

const MAX_PROOF_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_PROOF_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
]);

function CompleteTaskModal({
  task,
  businessId,
  onClose,
  onDone,
}: {
  task: Task;
  businessId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);

  function pickFile(f: File | null) {
    setFileError(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (f.type.startsWith("video/")) {
      setFileError("Video files aren't accepted as proof.");
      return;
    }
    if (f.size > MAX_PROOF_FILE_BYTES) {
      setFileError("File must be 5MB or smaller.");
      return;
    }
    if (!ALLOWED_PROOF_MIME_TYPES.has(f.type)) {
      setFileError("Unsupported file type — PDF, Word, Excel, text, or image files only.");
      return;
    }
    setFile(f);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    if (task.requiresProof && !file) {
      setFileError("This task requires a proof document.");
      return;
    }
    setError(null);

    try {
      let proofPath: string | undefined;
      if (file) {
        setPhase("uploading");
        const { path, token } = await apiFetch<{ path: string; token: string }>(
          `/api/v1/businesses/${businessId}/tasks/${task.id}/proof-upload-url`,
          { method: "POST", body: JSON.stringify({ fileName: file.name, fileSize: file.size, fileType: file.type }) }
        );
        const { error: uploadError } = await supabase.storage.from("task-proofs").uploadToSignedUrl(path, token, file);
        if (uploadError) throw new Error(uploadError.message);
        proofPath = path;
      }

      setPhase("saving");
      await apiFetch(`/api/v1/businesses/${businessId}/tasks/${task.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "done",
          completionDescription: description,
          ...(proofPath ? { proofPath, proofFileName: file!.name, proofFileSize: file!.size, proofFileType: file!.type } : {}),
        }),
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Failed to complete task");
      setPhase("idle");
    }
  }

  const busy = phase !== "idle";

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-card border border-gray-200 bg-white p-6 shadow-lg"
      >
        <h2 className="mb-1 text-lg font-semibold text-gray-900">Mark "{task.title}" done</h2>
        <p className="mb-4 text-xs text-gray-400">
          {task.requiresProof ? "This task requires a proof document." : "Describe how you completed it."}
        </p>

        <div className="flex flex-col gap-3">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description of how this was completed"
            rows={3}
            required
            className="rounded-card border border-gray-300 px-3 py-2 text-sm"
          />

          {task.requiresProof && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase text-gray-400">Proof document</p>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,image/*"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-gray-600 file:mr-3 file:rounded-card file:border-0 file:bg-gray-200 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-300"
              />
              <p className="mt-1 text-[11px] text-gray-400">PDF, Word, Excel, text, or image — up to 5MB, no video.</p>
              {fileError && <p className="mt-1 text-xs text-danger">{fileError}</p>}
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-card border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !!fileError}
              className="rounded-card bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {phase === "uploading" ? "Uploading…" : phase === "saving" ? "Saving…" : "Mark done"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
