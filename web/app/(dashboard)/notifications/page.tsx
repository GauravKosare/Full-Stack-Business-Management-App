"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

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

  function load() {
    apiFetch<Notification[]>("/api/v1/notifications")
      .then(setNotifications)
      .finally(() => setLoading(false));
  }

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
