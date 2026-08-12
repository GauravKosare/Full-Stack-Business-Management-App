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
                <p className="font-medium capitalize text-gray-900">{n.type.replace(/_/g, " ")}</p>
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
