"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { getToken, clearToken } from "@/lib/auth";
import { getActiveBusinessId, getActiveBusinessRole, clearActiveBusiness } from "@/lib/business";
import { STAFF_MANAGING_ROLES, ROLE_LABELS } from "@/lib/roles";
import NotificationBell from "./NotificationBell";
import { DashboardIcon, TasksIcon, ChatIcon, TeamIcon, BillingIcon, ProfileIcon, CollapseIcon } from "./icons";

const VALID_ROLES = ["owner", "director", "manager", "project_head", "employee"];
const ALL_ROLES = VALID_ROLES;
const SIDEBAR_COLLAPSED_KEY = "bma_sidebar_collapsed";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", roles: ALL_ROLES, Icon: DashboardIcon },
  { href: "/tasks", label: "Tasks", roles: ALL_ROLES, Icon: TasksIcon },
  { href: "/chat", label: "Chat", roles: ALL_ROLES, Icon: ChatIcon },
  { href: "/team", label: "Team", roles: STAFF_MANAGING_ROLES, Icon: TeamIcon },
  { href: "/billing", label: "Billing", roles: ["owner"], Icon: BillingIcon },
  { href: "/profile", label: "Profile", roles: ALL_ROLES, Icon: ProfileIcon },
];

type LayoutState = { status: "loading" } | { status: "ready"; role: string } | { status: "error"; message: string };

function businessInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<LayoutState>({ status: "loading" });
  const [business, setBusiness] = useState<{ name: string } | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/sign-in");
      return;
    }
    const businessId = getActiveBusinessId();
    if (!businessId) {
      router.replace("/select-business");
      return;
    }
    // businessId present but role missing/invalid shouldn't happen — setActiveBusiness
    // always sets both together — but if it ever does (corrupted localStorage, a future
    // bug), fail loudly with a recoverable error page instead of silently rendering a
    // blank screen with `if (!role) return null` and no way out.
    const role = getActiveBusinessRole();
    if (!role || !VALID_ROLES.includes(role)) {
      setState({ status: "error", message: "Your active business selection looks corrupted or out of date." });
      return;
    }
    setState({ status: "ready", role });
    apiFetch<{ name: string }>(`/api/v1/businesses/${businessId}`)
      .then(setBusiness)
      .catch(() => {});
    setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
  }, [router]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      return next;
    });
  }

  function signOut() {
    clearToken();
    clearActiveBusiness();
    router.replace("/sign-in");
  }

  if (state.status === "loading") return null;

  if (state.status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-8">
        <div className="max-w-sm rounded-card border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-medium text-danger">{state.message}</p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              onClick={() => router.push("/select-business")}
              className="rounded-card bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Choose a business
            </button>
            <button
              onClick={() => router.back()}
              className="rounded-card border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Go back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { role } = state;
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <div className="flex min-h-screen">
      <aside
        className={`flex shrink-0 flex-col bg-gray-200 transition-[width] duration-150 ${
          collapsed ? "w-[72px]" : "w-60"
        }`}
      >
        <div className={`flex items-center gap-2 px-3 py-4 ${collapsed ? "justify-center" : "justify-between"}`}>
          {!collapsed && <NotificationBell />}
          <button
            onClick={toggleCollapsed}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-700 hover:bg-gray-300"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <CollapseIcon className="h-4 w-4" collapsed={collapsed} />
          </button>
          {collapsed && <NotificationBell />}
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          {visibleItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 rounded-card px-3 py-2.5 text-sm font-medium ${
                  collapsed ? "justify-center" : ""
                } ${active ? "bg-blue-50 text-primary" : "text-gray-700 hover:bg-gray-300/60"}`}
              >
                <item.Icon className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-3">
          <button
            onClick={signOut}
            title={collapsed ? "Sign out" : undefined}
            className={`flex w-full items-center gap-3 rounded-card px-3 py-2.5 text-left text-sm text-gray-600 hover:bg-gray-300/60 ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-[18px] w-[18px] shrink-0">
              <path d="M15 4h-2.5A2.5 2.5 0 0 0 10 6.5v11A2.5 2.5 0 0 0 12.5 20H15" strokeLinecap="round" />
              <path d="M18.5 12h-9m0 0 3-3m-3 3 3 3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {!collapsed && "Sign out"}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-gray-200 bg-gray-50 px-8 py-3">
          <button
            onClick={() => router.push("/select-business")}
            className="flex items-center gap-2.5 rounded-card px-2 py-1.5 hover:bg-gray-200"
            title="Switch business"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
              {business ? businessInitial(business.name) : "…"}
            </span>
            <span className="text-left">
              <span className="block text-sm font-semibold leading-tight text-gray-900">
                {business?.name ?? "Loading…"}
              </span>
              <span className="block text-[11px] leading-tight text-gray-500">{ROLE_LABELS[role] ?? role}</span>
            </span>
          </button>
        </header>
        <main className="flex-1 overflow-y-auto bg-gray-50 p-8">{children}</main>
      </div>
    </div>
  );
}
