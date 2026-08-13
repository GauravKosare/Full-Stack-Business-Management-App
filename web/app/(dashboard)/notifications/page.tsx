"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { ErrorState } from "../ErrorState";

interface Notification {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

function describeNotification(n: Notification): string {
  switch (n.type) {
    case "invite":
      return `You were invited as ${n.payload.role ?? "a member"}`;
    case "task_assigned":
      return `Assigned to "${n.payload.title ?? "a task"}"`;
    case "task_completed":
      return `"${n.payload.title ?? "A task"}" was completed ${n.payload.onTime ? "on time" : "after its deadline"}`;
    case "task_due":
      return `Task due soon: "${n.payload.title ?? ""}"`;
    case "billing_event":
      return "Billing update";
    default:
      return n.type.replace(/_/g, " ");
  }
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    apiFetch<Notification[]>("/api/v1/notifications")
      .then(setNotifications)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load notifications"))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  async function markRead(id: string) {
    await apiFetch(`/api/v1/notifications/${id}/read`, { method: "PATCH" });
    load();
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Notifications</h1>

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <ul className="divide-y divide-gray-200 rounded-card border border-gray-200 bg-white">
          {notifications.map((n) => (
            <li
              key={n.id}
              className={`flex items-center justify-between px-4 py-3 text-sm ${n.readAt ? "" : "bg-blue-50/50"}`}
            >
              <div>
                <p className="font-medium text-gray-900">{describeNotification(n)}</p>
                <p className="text-xs text-gray-500">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
              {!n.readAt && (
                <button onClick={() => markRead(n.id)} className="text-xs font-medium text-primary hover:underline">
                  Mark read
                </button>
              )}
            </li>
          ))}
          {notifications.length === 0 && <li className="px-4 py-6 text-center text-gray-400">No notifications</li>}
        </ul>
      )}
    </div>
  );
}
