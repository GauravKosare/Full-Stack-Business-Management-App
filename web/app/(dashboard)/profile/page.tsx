"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { getActiveBusinessId, getActiveBusinessRole } from "@/lib/business";
import { ErrorState } from "../ErrorState";

interface Me {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  hasPassword: boolean;
  hasGoogle: boolean;
  createdAt: string;
}

interface Business {
  id: string;
  name: string;
  role: string;
}

interface NotificationItem {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
  readAt: string | null;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function describeNotification(n: NotificationItem): string {
  switch (n.type) {
    case "invite":
      return `You were invited as ${n.payload.role ?? "a member"}`;
    case "task_assigned":
      return `Assigned to "${n.payload.title ?? "a task"}"`;
    case "task_due":
      return `Task due: "${n.payload.title ?? ""}"`;
    case "billing_event":
      return "Billing update";
    default:
      return n.type;
  }
}

export default function ProfilePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [logs, setLogs] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const businessId = getActiveBusinessId();
    const requests: Promise<unknown>[] = [apiFetch<Me>("/api/v1/auth/me").then(setMe)];
    if (businessId) {
      requests.push(apiFetch<Business>(`/api/v1/businesses/${businessId}`).then(setBusiness));
    }
    requests.push(apiFetch<NotificationItem[]>("/api/v1/notifications").then((all) => setLogs(all.slice(0, 10))));

    Promise.all(requests)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load profile"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500">Loading…</p>;
  if (error) return <ErrorState message={error} />;
  if (!me) return null;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Profile</h1>

      <div className="mb-6 flex items-center gap-4 rounded-card border border-gray-200 bg-white p-6">
        {me.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={me.avatarUrl} alt={me.name} className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-lg font-semibold text-white">
            {initials(me.name)}
          </div>
        )}
        <div>
          <p className="text-lg font-semibold text-gray-900">{me.name}</p>
          <p className="text-sm text-gray-500">{me.email}</p>
          <div className="mt-1 flex gap-1.5">
            {me.hasGoogle && (
              <span className="rounded-pill bg-blue-50 px-2 py-0.5 text-xs font-medium text-primary">Google linked</span>
            )}
            {me.hasPassword && (
              <span className="rounded-pill bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">Password set</span>
            )}
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="rounded-card border border-gray-200 bg-white p-4">
          <p className="text-xs uppercase text-gray-400">Current business</p>
          <p className="mt-1 text-sm font-medium text-gray-900">{business?.name ?? "—"}</p>
        </div>
        <div className="rounded-card border border-gray-200 bg-white p-4">
          <p className="text-xs uppercase text-gray-400">Role</p>
          <p className="mt-1 text-sm font-medium capitalize text-gray-900">
            {business?.role ?? getActiveBusinessRole() ?? "—"}
          </p>
        </div>
        <div className="rounded-card border border-gray-200 bg-white p-4">
          <p className="text-xs uppercase text-gray-400">Member since</p>
          <p className="mt-1 text-sm font-medium text-gray-900">{new Date(me.createdAt).toLocaleDateString()}</p>
        </div>
      </div>

      <h2 className="mb-3 text-sm font-semibold text-gray-700">Recent activity</h2>
      <div className="divide-y divide-gray-100 rounded-card border border-gray-200 bg-white">
        {logs.map((n) => (
          <div key={n.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <span className={n.readAt ? "text-gray-600" : "font-medium text-gray-900"}>{describeNotification(n)}</span>
            <span className="text-xs text-gray-400">{new Date(n.createdAt).toLocaleString()}</span>
          </div>
        ))}
        {logs.length === 0 && <p className="px-4 py-6 text-center text-sm text-gray-400">No activity yet</p>}
      </div>
    </div>
  );
}
