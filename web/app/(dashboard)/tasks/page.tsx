"use client";

import { useEffect, useState, FormEvent } from "react";
import { apiFetch } from "@/lib/api";
import { getActiveBusinessId } from "@/lib/business";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueAt: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  open: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  done: "bg-green-100 text-green-700",
  canceled: "bg-red-100 text-red-700 line-through",
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const businessId = getActiveBusinessId();

  function load() {
    if (!businessId) return;
    apiFetch<Task[]>(`/api/v1/businesses/${businessId}/tasks`)
      .then(setTasks)
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [businessId]);

  async function createTask(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !businessId) return;
    await apiFetch(`/api/v1/businesses/${businessId}/tasks`, {
      method: "POST",
      body: JSON.stringify({ title }),
    });
    setTitle("");
    load();
  }

  async function markDone(taskId: string) {
    if (!businessId) return;
    await apiFetch(`/api/v1/businesses/${businessId}/tasks/${taskId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "done" }),
    });
    load();
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Tasks</h1>

      <form onSubmit={createTask} className="mb-6 flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New task title"
          className="flex-1 rounded-card border border-gray-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-card bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90">
          Add task
        </button>
      </form>

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : (
        <table className="w-full overflow-hidden rounded-card border border-gray-200 bg-white text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Priority</th>
              <th className="px-4 py-2">Due</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tasks.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3">{t.title}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-pill px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[t.status]}`}>
                    {t.status}
                  </span>
                </td>
                <td className="px-4 py-3 capitalize">{t.priority}</td>
                <td className="px-4 py-3">{t.dueAt ? new Date(t.dueAt).toLocaleDateString() : "—"}</td>
                <td className="px-4 py-3 text-right">
                  {t.status !== "done" && (
                    <button onClick={() => markDone(t.id)} className="text-xs font-medium text-primary hover:underline">
                      Mark done
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  No tasks yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
