"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { getActiveBusinessId, getActiveBusinessRole } from "@/lib/business";
import { isStaffManaging } from "@/lib/roles";
import { ErrorState } from "../ErrorState";

interface Assignment {
  userId: string;
  completedAt: string | null;
  user: { id: string; name: string };
}

interface Task {
  id: string;
  status: "open" | "in_progress" | "done" | "canceled";
  priority: "low" | "medium" | "high";
  dueAt: string | null;
  assignments: Assignment[];
}

interface Member {
  id: string;
  user: { id: string; name: string };
}

const STATUS_META: { status: Task["status"]; label: string; barClass: string; dotClass: string }[] = [
  { status: "open", label: "Open", barClass: "bg-gray-400", dotClass: "bg-gray-400" },
  { status: "in_progress", label: "In progress", barClass: "bg-primary", dotClass: "bg-primary" },
  { status: "done", label: "Done", barClass: "bg-success", dotClass: "bg-success" },
  { status: "canceled", label: "Canceled", barClass: "bg-danger", dotClass: "bg-danger" },
];

const POLL_INTERVAL_MS = 15000;

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const businessId = getActiveBusinessId();
  const role = getActiveBusinessRole();
  // Deeper analytics (workload, leaderboard, day-over-day trend) are for anyone who
  // manages people below them — Owner, Director ("department head"), Manager, Project
  // Head — not Employee. The underlying task data itself is already scoped to each
  // viewer's subordinates by the API (see api/src/routes/tasks.ts), so nothing extra is
  // needed here to keep the analytics limited to "roles below them."
  const isElevated = isStaffManaging(role);

  useEffect(() => {
    if (!businessId) return;

    let cancelled = false;

    function refresh(isFirstLoad: boolean) {
      const requests: Promise<unknown>[] = [apiFetch<Task[]>(`/api/v1/businesses/${businessId}/tasks`).then(setTasks)];
      if (isElevated) {
        requests.push(apiFetch<Member[]>(`/api/v1/businesses/${businessId}/members`).then(setMembers));
      }
      Promise.all(requests)
        .then(() => {
          if (cancelled) return;
          setError(null);
          setLastUpdated(new Date());
        })
        .catch((err) => {
          if (cancelled) return;
          setError(err instanceof ApiError ? err.message : "Failed to load dashboard");
        })
        .finally(() => {
          if (!cancelled && isFirstLoad) setLoading(false);
        });
    }

    refresh(true);
    const interval = setInterval(() => refresh(false), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const statusCounts = useMemo(() => {
    const counts = new Map<Task["status"], number>();
    for (const t of tasks) counts.set(t.status, (counts.get(t.status) ?? 0) + 1);
    return counts;
  }, [tasks]);

  const total = tasks.length;
  const done = statusCounts.get("done") ?? 0;
  const overdue = tasks.filter((t) => t.dueAt && t.status !== "done" && t.status !== "canceled" && new Date(t.dueAt) < new Date()).length;
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
  const maxStatusCount = Math.max(1, ...STATUS_META.map((s) => statusCounts.get(s.status) ?? 0));

  const { completedToday, completedYesterday } = useMemo(() => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    let today = 0;
    let prior = 0;
    for (const t of tasks) {
      for (const a of t.assignments) {
        if (!a.completedAt) continue;
        const completed = new Date(a.completedAt);
        if (isSameDay(completed, now)) today += 1;
        else if (isSameDay(completed, yesterday)) prior += 1;
      }
    }
    return { completedToday: today, completedYesterday: prior };
  }, [tasks]);
  const growth = completedToday - completedYesterday;

  const workload = useMemo(() => {
    const counts = new Map<string, { name: string; open: number }>();
    for (const m of members) counts.set(m.user.id, { name: m.user.name, open: 0 });
    for (const t of tasks) {
      if (t.status === "done" || t.status === "canceled") continue;
      for (const a of t.assignments) {
        const entry = counts.get(a.userId) ?? { name: a.user.name, open: 0 };
        entry.open += 1;
        counts.set(a.userId, entry);
      }
    }
    return [...counts.values()].sort((a, b) => b.open - a.open).slice(0, 8);
  }, [tasks, members]);
  const maxWorkload = Math.max(1, ...workload.map((w) => w.open));

  const leaderboard = useMemo(() => {
    const counts = new Map<string, { name: string; completed: number }>();
    for (const m of members) counts.set(m.user.id, { name: m.user.name, completed: 0 });
    for (const t of tasks) {
      if (t.status !== "done") continue;
      for (const a of t.assignments) {
        if (!a.completedAt) continue;
        const entry = counts.get(a.userId) ?? { name: a.user.name, completed: 0 };
        entry.completed += 1;
        counts.set(a.userId, entry);
      }
    }
    return [...counts.values()].sort((a, b) => b.completed - a.completed).slice(0, 8);
  }, [tasks, members]);
  const maxLeaderboard = Math.max(1, ...leaderboard.map((l) => l.completed));

  if (loading) return <p className="text-gray-500">Loading…</p>;
  if (error && total === 0) return <ErrorState message={error} />;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        {lastUpdated && (
          <p className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Live · updated {lastUpdated.toLocaleTimeString()}
          </p>
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Total tasks" value={total} />
        <StatTile label="Completed" value={done} />
        <StatTile label="Completion rate" value={`${completionRate}%`} />
        <StatTile label="Overdue" value={overdue} tone={overdue > 0 ? "warning" : undefined} />
      </div>

      {isElevated && (
        <div className="mb-6 rounded-card border border-gray-200 bg-white p-5">
          <p className="text-xs uppercase text-gray-400">Completed today vs. yesterday</p>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="text-2xl font-semibold text-gray-900">{completedToday}</span>
            <span
              className={`flex items-center gap-1 text-sm font-medium ${
                growth > 0 ? "text-success" : growth < 0 ? "text-warning" : "text-gray-400"
              }`}
              title={`${completedToday} completed today vs. ${completedYesterday} yesterday`}
            >
              {growth > 0 ? "▲" : growth < 0 ? "▼" : "—"} {growth === 0 ? "No change" : `${Math.abs(growth)} vs. yesterday`}
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-card border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Tasks by status</h2>
          <div className="flex flex-col gap-3">
            {STATUS_META.map((s) => {
              const count = statusCounts.get(s.status) ?? 0;
              return (
                <div key={s.status} title={`${s.label}: ${count}`}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-gray-700">
                      <span className={`h-2 w-2 rounded-full ${s.dotClass}`} />
                      {s.label}
                    </span>
                    <span className="text-gray-400">{count}</span>
                  </div>
                  <div className="h-2 rounded-pill bg-gray-100">
                    <div
                      className={`h-2 rounded-pill transition-all ${s.barClass}`}
                      style={{ width: `${(count / maxStatusCount) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {total === 0 && <p className="text-center text-sm text-gray-400">No tasks yet</p>}
          </div>
        </div>

        {isElevated ? (
          <div className="rounded-card border border-gray-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-gray-700">Team workload (open tasks)</h2>
            <div className="flex flex-col gap-3">
              {workload.map((w) => (
                <div key={w.name} title={`${w.name}: ${w.open} open`}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-700">{w.name}</span>
                    <span className="text-gray-400">{w.open}</span>
                  </div>
                  <div className="h-2 rounded-pill bg-gray-100">
                    <div className="h-2 rounded-pill bg-primary transition-all" style={{ width: `${(w.open / maxWorkload) * 100}%` }} />
                  </div>
                </div>
              ))}
              {workload.length === 0 && <p className="text-center text-sm text-gray-400">No team members yet</p>}
            </div>
          </div>
        ) : (
          <div className="rounded-card border border-gray-200 bg-white p-5">
            <h2 className="mb-2 text-sm font-semibold text-gray-700">Your tasks</h2>
            <p className="text-sm text-gray-500">
              You have {tasks.filter((t) => t.status !== "done" && t.status !== "canceled").length} open task(s) assigned to you.
            </p>
          </div>
        )}

        {isElevated && (
          <div className="rounded-card border border-gray-200 bg-white p-5 lg:col-span-2">
            <h2 className="mb-1 text-sm font-semibold text-gray-700">Who's completing the most — and who isn't</h2>
            <p className="mb-4 text-xs text-gray-400">Completed tasks, all time, among people you manage</p>
            <div className="flex flex-col gap-3">
              {leaderboard.map((l, i) => (
                <div key={l.name} title={`${l.name}: ${l.completed} completed`}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-gray-700">
                      {i === 0 && l.completed > 0 && <span title="Top completer">🏆</span>}
                      {l.name}
                    </span>
                    <span className={l.completed === 0 ? "text-warning" : "text-gray-400"}>{l.completed}</span>
                  </div>
                  <div className="h-2 rounded-pill bg-gray-100">
                    <div
                      className={`h-2 rounded-pill transition-all ${l.completed === 0 ? "bg-warning" : "bg-success"}`}
                      style={{ width: `${Math.max((l.completed / maxLeaderboard) * 100, l.completed === 0 ? 4 : 0)}%` }}
                    />
                  </div>
                </div>
              ))}
              {leaderboard.length === 0 && <p className="text-center text-sm text-gray-400">No team members yet</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({ label, value, tone }: { label: string; value: string | number; tone?: "warning" }) {
  return (
    <div className="rounded-card border border-gray-200 bg-white p-5">
      <p className="text-xs uppercase text-gray-400">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone === "warning" ? "text-warning" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}
