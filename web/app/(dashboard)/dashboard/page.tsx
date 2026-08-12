"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { getActiveBusinessId } from "@/lib/business";
import { ErrorState } from "../ErrorState";

interface Task {
  id: string;
  title: string;
  status: string;
  dueAt: string | null;
}

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const businessId = getActiveBusinessId();
    if (!businessId) return;
    apiFetch<Task[]>(`/api/v1/businesses/${businessId}/tasks`)
      .then(setTasks)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  const open = tasks.filter((t) => t.status === "open" || t.status === "in_progress").length;
  const done = tasks.filter((t) => t.status === "done").length;

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Dashboard</h1>
      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-card border border-gray-200 bg-white p-5">
            <p className="text-xs uppercase text-gray-400">Open tasks</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{open}</p>
          </div>
          <div className="rounded-card border border-gray-200 bg-white p-5">
            <p className="text-xs uppercase text-gray-400">Completed</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{done}</p>
          </div>
          <div className="rounded-card border border-gray-200 bg-white p-5">
            <p className="text-xs uppercase text-gray-400">Total</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{tasks.length}</p>
          </div>
        </div>
      )}
    </div>
  );
}
