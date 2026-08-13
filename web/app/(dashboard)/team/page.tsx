"use client";

import { useEffect, useState, FormEvent } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { getActiveBusinessId } from "@/lib/business";
import { ErrorState } from "../ErrorState";

interface Member {
  id: string;
  role: string;
  joinedAt: string | null;
  user: { name: string; email: string };
}

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("employee");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const businessId = getActiveBusinessId();

  function load() {
    if (!businessId) return;
    apiFetch<Member[]>(`/api/v1/businesses/${businessId}/members`)
      .then(setMembers)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load team"))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [businessId]);

  async function invite(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !businessId) return;
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(null);
    try {
      await apiFetch(`/api/v1/businesses/${businessId}/members`, {
        method: "POST",
        body: JSON.stringify({ email, role }),
      });
      setInviteSuccess(`Invite sent to ${email}.`);
      setEmail("");
      load();
    } catch (err) {
      setInviteError(err instanceof ApiError ? err.message : "Failed to send invite");
    } finally {
      setInviting(false);
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Team</h1>

      <form onSubmit={invite} className="mb-2 flex gap-2">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email to invite"
          type="email"
          required
          className="flex-1 rounded-card border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-card border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="employee">Employee</option>
          <option value="manager">Manager</option>
          <option value="client">Client</option>
        </select>
        <button
          type="submit"
          disabled={inviting}
          className="rounded-card bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {inviting ? "Inviting…" : "Invite"}
        </button>
      </form>
      {inviteError && <p className="mb-4 text-sm text-danger">{inviteError}</p>}
      {inviteSuccess && <p className="mb-4 text-sm text-success">{inviteSuccess}</p>}

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <table className="w-full overflow-hidden rounded-card border border-gray-200 bg-white text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {members.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-3">{m.user.name}</td>
                <td className="px-4 py-3">{m.user.email}</td>
                <td className="px-4 py-3 capitalize">{m.role}</td>
                <td className="px-4 py-3">{m.joinedAt ? "Joined" : "Pending"}</td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                  No members yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
