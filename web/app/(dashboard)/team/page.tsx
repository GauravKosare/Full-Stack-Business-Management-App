"use client";

import { useEffect, useState, FormEvent } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { getActiveBusinessId, getActiveBusinessRole } from "@/lib/business";
import { assignableRolesFor, outranks, ROLE_LABELS } from "@/lib/roles";
import { ErrorState } from "../ErrorState";

interface Member {
  id: string;
  role: string;
  department: string | null;
  joinedAt: string | null;
  user: { name: string; email: string };
}

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const businessId = getActiveBusinessId();
  const myRole = getActiveBusinessRole();
  const invitableRoles = assignableRolesFor(myRole);

  function load() {
    if (!businessId) return;
    apiFetch<Member[]>(`/api/v1/businesses/${businessId}/members`)
      .then(setMembers)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load team"))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [businessId]);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Team</h1>

      <InviteForm
        businessId={businessId}
        invitableRoles={invitableRoles}
        onDone={load}
      />

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
              <th className="px-4 py-2">Department</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {members.map((m) => {
              const canEdit = m.role !== "owner" && outranks(myRole, m.role);
              return (
                <tr key={m.id}>
                  <td className="px-4 py-3">{m.user.name}</td>
                  <td className="px-4 py-3">{m.user.email}</td>
                  <td className="px-4 py-3">{ROLE_LABELS[m.role] ?? m.role}</td>
                  <td className="px-4 py-3 text-gray-500">{m.department ?? "—"}</td>
                  <td className="px-4 py-3">{m.joinedAt ? "Joined" : "Pending"}</td>
                  <td className="px-4 py-3 text-right">
                    {canEdit && (
                      <button
                        onClick={() => setEditingMember(m)}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {members.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  No members yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {editingMember && (
        <EditMemberModal
          member={editingMember}
          businessId={businessId}
          invitableRoles={invitableRoles}
          onClose={() => setEditingMember(null)}
          onDone={() => {
            setEditingMember(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function InviteForm({
  businessId,
  invitableRoles,
  onDone,
}: {
  businessId: string | null;
  invitableRoles: string[];
  onDone: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(invitableRoles[invitableRoles.length - 1] ?? "employee");
  const [department, setDepartment] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  async function invite(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !businessId) return;
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(null);
    try {
      await apiFetch(`/api/v1/businesses/${businessId}/members`, {
        method: "POST",
        body: JSON.stringify({ email, role, department: department || undefined }),
      });
      setInviteSuccess(`Invite sent to ${email}.`);
      setEmail("");
      setDepartment("");
      onDone();
    } catch (err) {
      setInviteError(err instanceof ApiError ? err.message : "Failed to send invite");
    } finally {
      setInviting(false);
    }
  }

  if (invitableRoles.length === 0) return null;

  return (
    <>
      <form onSubmit={invite} className="mb-2 flex flex-wrap gap-2">
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
          {invitableRoles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r] ?? r}
            </option>
          ))}
        </select>
        <input
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          placeholder="Department (optional)"
          className="w-40 rounded-card border border-gray-300 px-3 py-2 text-sm"
        />
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
    </>
  );
}

function EditMemberModal({
  member,
  businessId,
  invitableRoles,
  onClose,
  onDone,
}: {
  member: Member;
  businessId: string | null;
  invitableRoles: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [role, setRole] = useState(member.role);
  const [department, setDepartment] = useState(member.department ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roleOptions = invitableRoles.includes(member.role) ? invitableRoles : [member.role, ...invitableRoles];

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!businessId) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/businesses/${businessId}/members`, {
        method: "POST",
        body: JSON.stringify({ email: member.user.email, role, department: department || undefined }),
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update member");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-card border border-gray-200 bg-white p-6 shadow-lg"
      >
        <h2 className="mb-1 text-lg font-semibold text-gray-900">Edit {member.user.name}</h2>
        <p className="mb-4 text-xs text-gray-400">{member.user.email}</p>

        <div className="flex flex-col gap-3">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-card border border-gray-300 px-3 py-2 text-sm"
          >
            {roleOptions.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r] ?? r}
              </option>
            ))}
          </select>
          <input
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="Department (optional)"
            className="rounded-card border border-gray-300 px-3 py-2 text-sm"
          />

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-card border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-card bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
