"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { getToken, clearToken } from "@/lib/auth";
import { getActiveBusinessId, getActiveBusinessRole, clearActiveBusiness } from "@/lib/business";

const VALID_ROLES = ["owner", "manager", "employee", "client"];

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", roles: ["owner", "manager", "employee"] },
  { href: "/tasks", label: "Tasks", roles: ["owner", "manager", "employee"] },
  { href: "/team", label: "Team", roles: ["owner", "manager"] },
  { href: "/billing", label: "Billing", roles: ["owner", "manager"] },
  { href: "/notifications", label: "Notifications", roles: ["owner", "manager", "employee"] },
];

type LayoutState = { status: "loading" } | { status: "ready"; role: string } | { status: "error"; message: string };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<LayoutState>({ status: "loading" });

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
  }, [router]);

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
      <aside className="flex w-60 shrink-0 flex-col border-r border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-4">
          <button
            onClick={() => router.push("/select-business")}
            className="text-sm font-medium text-gray-900 hover:text-primary"
          >
            Switch business
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {visibleItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-card px-3 py-2 text-sm font-medium ${
                pathname === item.href ? "bg-blue-50 text-primary" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-gray-200 p-3">
          <button
            onClick={signOut}
            className="w-full rounded-card px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 bg-gray-50 p-8">{children}</main>
    </div>
  );
}
