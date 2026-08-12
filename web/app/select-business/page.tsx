"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { setActiveBusiness } from "@/lib/business";

interface Business {
  id: string;
  name: string;
  role: string;
}

export default function SelectBusinessPage() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/sign-in");
      return;
    }
    apiFetch<Business[]>("/api/v1/businesses")
      .then(setBusinesses)
      .finally(() => setLoading(false));
  }, [router]);

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
    <div className="mx-auto max-w-md p-8">
      <h1 className="mb-4 text-lg font-semibold text-gray-900">Select a business</h1>
      <ul className="mb-6 divide-y divide-gray-200 rounded-card border border-gray-200 bg-white">
        {businesses.map((b) => (
          <li key={b.id}>
            <button
              onClick={() => selectBusiness(b)}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
            >
              <span>{b.name}</span>
              <span className="text-xs uppercase text-gray-400">{b.role}</span>
            </button>
          </li>
        ))}
        {businesses.length === 0 && <li className="px-4 py-3 text-sm text-gray-500">No businesses yet</li>}
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
  );
}
