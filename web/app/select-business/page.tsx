"use client";

import { Suspense, useEffect, useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { setActiveBusiness } from "@/lib/business";
import { ROLE_LABELS } from "@/lib/roles";
import { AuthMark } from "../AuthBrandPanel";

interface Business {
  id: string;
  name: string;
  role: string;
}

const WELCOME_MESSAGES: Record<string, string> = {
  signup: "Congratulations, and welcome! Your sign-up is complete.",
  login: "You've successfully logged in.",
};

function businessInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export default function SelectBusinessPage() {
  return (
    <Suspense fallback={<p className="p-8 text-gray-500">Loading…</p>}>
      <SelectBusinessContent />
    </Suspense>
  );
}

function SelectBusinessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [welcome, setWelcome] = useState<string | null>(
    () => WELCOME_MESSAGES[searchParams.get("welcome") ?? ""] ?? null
  );

  useEffect(() => {
    if (!getToken()) {
      router.replace("/sign-in");
      return;
    }
    apiFetch<Business[]>("/api/v1/businesses")
      .then(setBusinesses)
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (!welcome) return;
    const timer = setTimeout(() => setWelcome(null), 5000);
    return () => clearTimeout(timer);
  }, [welcome]);

  function selectBusiness(business: Business) {
    setActiveBusiness(business.id, business.role);
    router.push("/dashboard");
  }

  async function createBusiness(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const business = await apiFetch<{ id: string; name: string }>("/api/v1/businesses", {
        method: "POST",
        body: JSON.stringify({ name: newName }),
      });
      selectBusiness({ ...business, role: "owner" });
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <p className="p-8 text-gray-500">Loading…</p>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <AuthMark className="mb-3" />
          <h1 className="text-lg font-semibold text-gray-900">Select a business</h1>
          <p className="mt-1 text-sm text-gray-500">Choose where you want to work</p>
        </div>

        {welcome && (
          <div className="mb-4 rounded-card border border-success/30 bg-success/10 px-4 py-3 text-center text-sm text-success">
            {welcome}
          </div>
        )}

        <ul className="mb-6 divide-y divide-gray-200 overflow-hidden rounded-card border border-gray-200 bg-white">
          {businesses.map((b) => (
            <li key={b.id}>
              <button
                onClick={() => selectBusiness(b)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                  {businessInitial(b.name)}
                </span>
                <span className="flex-1 text-sm font-medium text-gray-900">{b.name}</span>
                <span className="rounded-pill bg-gray-100 px-2.5 py-1 text-[11px] font-medium uppercase text-gray-500">
                  {ROLE_LABELS[b.role] ?? b.role}
                </span>
              </button>
            </li>
          ))}
          {businesses.length === 0 && <li className="px-4 py-6 text-center text-sm text-gray-400">No businesses yet</li>}
        </ul>

        <form onSubmit={createBusiness} className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New business name"
            className="flex-1 rounded-card border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={creating}
            className="rounded-card bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Create
          </button>
        </form>
      </div>
    </div>
  );
}
