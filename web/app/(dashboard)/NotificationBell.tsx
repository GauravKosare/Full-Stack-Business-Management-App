"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getActiveBusinessId } from "@/lib/business";

interface Notification {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

const POLL_INTERVAL_MS = 10000;

function summarize(n: Notification): string {
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
    case "channel_invite":
      return `You were added to "${n.payload.channelName ?? "a channel"}"`;
    default:
      return n.type.replace(/_/g, " ");
  }
}

function detail(n: Notification): { description: string; actionLabel: string; actionHref: string } {
  switch (n.type) {
    case "invite":
      return {
        description: `You've been invited to this business as ${n.payload.role ?? "a member"}. Head to the Team page to see your role and teammates.`,
        actionLabel: "Go to Team",
        actionHref: "/team",
      };
    case "task_assigned":
      return {
        description: `You were assigned to the task "${n.payload.title ?? "a task"}". Open Tasks to see its details, due date, and move it through its board.`,
        actionLabel: "Go to Tasks",
        actionHref: "/tasks",
      };
    case "task_completed":
      return {
        description: `"${n.payload.title ?? "A task"}" you created was marked done ${
          n.payload.onTime ? "on time, before its deadline." : "after its deadline had passed."
        }`,
        actionLabel: "Go to Tasks",
        actionHref: "/tasks",
      };
    case "task_due":
      return {
        description: `The task "${n.payload.title ?? ""}" is due soon.`,
        actionLabel: "Go to Tasks",
        actionHref: "/tasks",
      };
    case "billing_event":
      return {
        description: "Your business's subscription status changed. Check the Billing page for details.",
        actionLabel: "Go to Billing",
        actionHref: "/billing",
      };
    case "channel_invite":
      return {
        description: `You were added to the "${n.payload.channelName ?? "channel"}" chat channel. Open Chat to see it and start messaging.`,
        actionLabel: "Go to Chat",
        actionHref: "/chat",
      };
    default:
      return { description: n.type.replace(/_/g, " "), actionLabel: "Dismiss", actionHref: "" };
  }
}

export default function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Notification | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function load() {
    const businessId = getActiveBusinessId();
    if (!businessId) return;
    apiFetch<Notification[]>(`/api/v1/notifications?businessId=${businessId}`)
      .then(setNotifications)
      .catch(() => {});
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function openNotification(n: Notification) {
    setSelected(n);
    if (!n.readAt) {
      await apiFetch(`/api/v1/notifications/${n.id}/read`, { method: "PATCH" }).catch(() => {});
      load();
    }
  }

  function runAction() {
    if (!selected) return;
    const { actionHref } = detail(selected);
    setSelected(null);
    setOpen(false);
    if (actionHref) router.push(actionHref);
  }

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm hover:bg-gray-50"
        aria-label="Notifications"
      >
        <span aria-hidden>🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-pill bg-danger px-1 text-[10px] font-medium text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-11 z-20 w-80 rounded-card border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 px-4 py-2 text-xs font-medium uppercase text-gray-400">
            Notifications
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => openNotification(n)}
                className={`flex w-full flex-col items-start gap-0.5 border-b border-gray-50 px-4 py-2.5 text-left text-sm hover:bg-gray-50 ${
                  n.readAt ? "" : "bg-blue-50/50"
                }`}
              >
                <span className={n.readAt ? "text-gray-600" : "font-medium text-gray-900"}>{summarize(n)}</span>
                <span className="text-[11px] text-gray-400">{new Date(n.createdAt).toLocaleString()}</span>
              </button>
            ))}
            {notifications.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-gray-400">No notifications</p>
            )}
          </div>
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-card border border-gray-200 bg-white p-6 shadow-lg"
          >
            <h2 className="mb-1 text-sm font-semibold text-gray-900">{summarize(selected)}</h2>
            <p className="mb-4 text-xs text-gray-400">{new Date(selected.createdAt).toLocaleString()}</p>
            <p className="mb-6 text-sm text-gray-600">{detail(selected).description}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSelected(null)}
                className="rounded-card border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
              {detail(selected).actionHref && (
                <button
                  onClick={runAction}
                  className="rounded-card bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  {detail(selected).actionLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
