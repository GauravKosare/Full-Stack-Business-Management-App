"use client";

import { useEffect, useMemo, useRef, useState, FormEvent } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { getActiveBusinessId, getActiveBusinessRole } from "@/lib/business";
import { isStaffManaging } from "@/lib/roles";
import { supabase } from "@/lib/supabase";
import { ErrorState } from "../ErrorState";

interface UserSummary {
  id: string;
  name: string;
  email?: string;
  avatarUrl: string | null;
}

interface Message {
  id: string;
  channelId: string;
  senderId: string;
  body: string;
  createdAt: string;
  sender: UserSummary;
}

interface ChannelSummary {
  id: string;
  type: "direct" | "department" | "company" | "custom";
  name: string | null;
  description: string | null;
  department: string | null;
  otherMembers: UserSummary[];
  lastMessage: Message | null;
  unreadCount: number;
}

const POLL_INTERVAL_MS = 15000;

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function channelLabel(c: ChannelSummary): string {
  if (c.type === "company") return "Company";
  if (c.type === "department") return c.department ?? "Department";
  if (c.type === "custom") return c.name ?? "Channel";
  return c.otherMembers[0]?.name ?? "Direct message";
}

export default function ChatPage() {
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [startingDm, setStartingDm] = useState(false);
  const [creatingChannel, setCreatingChannel] = useState(false);
  const businessId = getActiveBusinessId();
  const role = getActiveBusinessRole();
  const canCreateChannel = isStaffManaging(role);
  const scrollRef = useRef<HTMLDivElement>(null);

  function loadChannels() {
    if (!businessId) return;
    apiFetch<ChannelSummary[]>(`/api/v1/businesses/${businessId}/channels`)
      .then((cs) => {
        setChannels(cs);
        setActiveChannelId((current) => current ?? cs.find((c) => c.type === "company")?.id ?? cs[0]?.id ?? null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load channels"))
      .finally(() => setLoadingChannels(false));
  }

  useEffect(() => {
    loadChannels();
    const interval = setInterval(loadChannels, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  useEffect(() => {
    if (!activeChannelId) return;
    setLoadingMessages(true);
    apiFetch<Message[]>(`/api/v1/businesses/${businessId}/channels/${activeChannelId}/messages`)
      .then(setMessages)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load messages"))
      .finally(() => setLoadingMessages(false));

    apiFetch(`/api/v1/businesses/${businessId}/channels/${activeChannelId}/read`, { method: "PATCH" }).catch(() => {});

    // Realtime broadcast delivers new messages instantly when configured (see
    // api/src/lib/realtime.ts) — this poll is a fallback so the thread still updates
    // (just with up to ~8s of lag) if the broadcast never fires, e.g. before
    // SUPABASE_SERVICE_ROLE_KEY is set on the API, or if a broadcast is dropped.
    const pollInterval = setInterval(() => {
      apiFetch<Message[]>(`/api/v1/businesses/${businessId}/channels/${activeChannelId}/messages`)
        .then((fresh) => {
          setMessages((prev) => {
            const knownIds = new Set(prev.map((m) => m.id));
            const newOnes = fresh.filter((m) => !knownIds.has(m.id));
            return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
          });
        })
        .catch(() => {});
    }, 8000);

    const sub = supabase
      .channel(`channel:${activeChannelId}`)
      .on("broadcast", { event: "new_message" }, (payload) => {
        const incoming = (payload.payload as { message: Message }).message;
        setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
      })
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(sub);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChannelId, businessId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !activeChannelId || !businessId) return;
    setSending(true);
    try {
      const message = await apiFetch<Message>(`/api/v1/businesses/${businessId}/channels/${activeChannelId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: draft }),
      });
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
      setDraft("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  async function startDm(userId: string) {
    if (!businessId) return;
    const channel = await apiFetch<{ id: string }>(`/api/v1/businesses/${businessId}/channels/direct`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
    setStartingDm(false);
    loadChannels();
    setActiveChannelId(channel.id);
  }

  async function createChannel(data: { name: string; description?: string; department?: string; memberIds: string[] }) {
    if (!businessId) return;
    const channel = await apiFetch<{ id: string }>(`/api/v1/businesses/${businessId}/channels`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    setCreatingChannel(false);
    loadChannels();
    setActiveChannelId(channel.id);
  }

  const grouped = useMemo(() => {
    return {
      company: channels.filter((c) => c.type === "company"),
      department: channels.filter((c) => c.type === "department"),
      custom: channels.filter((c) => c.type === "custom"),
      direct: channels.filter((c) => c.type === "direct"),
    };
  }, [channels]);

  const activeChannel = channels.find((c) => c.id === activeChannelId);

  if (loadingChannels) return <p className="text-gray-500">Loading…</p>;

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4">
      <aside className="w-64 shrink-0 overflow-y-auto rounded-card border border-gray-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <h1 className="text-sm font-semibold text-gray-900">Chat</h1>
          <div className="flex gap-2">
            {canCreateChannel && (
              <button
                onClick={() => setCreatingChannel(true)}
                className="text-xs font-medium text-primary hover:underline"
              >
                + Channel
              </button>
            )}
            <button onClick={() => setStartingDm(true)} className="text-xs font-medium text-primary hover:underline">
              + DM
            </button>
          </div>
        </div>

        {(["company", "department", "custom", "direct"] as const).map((group) =>
          grouped[group].length > 0 ? (
            <div key={group} className="mb-3">
              <p className="mb-1 px-1 text-xs font-medium uppercase text-gray-400">
                {group === "company"
                  ? "Company"
                  : group === "department"
                    ? "Department"
                    : group === "custom"
                      ? "Channels"
                      : "Direct messages"}
              </p>
              {grouped[group].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveChannelId(c.id)}
                  className={`flex w-full items-center justify-between rounded-card px-2 py-1.5 text-left text-sm ${
                    activeChannelId === c.id ? "bg-blue-50 text-primary" : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span className="truncate">{channelLabel(c)}</span>
                  {c.unreadCount > 0 && (
                    <span className="ml-2 rounded-pill bg-primary px-1.5 text-[10px] font-medium text-white">
                      {c.unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : null
        )}

        {channels.length === 0 && <p className="px-1 text-xs text-gray-400">No channels yet</p>}
      </aside>

      <div className="flex flex-1 flex-col rounded-card border border-gray-200 bg-white">
        {error && (
          <div className="p-3">
            <ErrorState message={error} />
          </div>
        )}

        {activeChannel ? (
          <>
            <div className="border-b border-gray-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-900">{channelLabel(activeChannel)}</h2>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
              {loadingMessages ? (
                <p className="text-sm text-gray-400">Loading messages…</p>
              ) : messages.length === 0 ? (
                <p className="text-sm text-gray-400">No messages yet — say hello.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {messages.map((m) => (
                    <div key={m.id} className="flex items-start gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-white">
                        {initials(m.sender.name)}
                      </span>
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-medium text-gray-900">{m.sender.name}</span>
                          <span className="text-[11px] text-gray-400">{new Date(m.createdAt).toLocaleTimeString()}</span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-gray-700">{m.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={sendMessage} className="flex gap-2 border-t border-gray-200 p-3">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Message…"
                className="flex-1 rounded-card border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                className="rounded-card bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                Send
              </button>
            </form>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
            Select a channel to start chatting
          </div>
        )}
      </div>

      {startingDm && (
        <StartDmModal businessId={businessId} onClose={() => setStartingDm(false)} onPick={startDm} />
      )}

      {creatingChannel && (
        <CreateChannelModal
          businessId={businessId}
          onClose={() => setCreatingChannel(false)}
          onCreate={createChannel}
        />
      )}
    </div>
  );
}

function StartDmModal({
  businessId,
  onClose,
  onPick,
}: {
  businessId: string | null;
  onClose: () => void;
  onPick: (userId: string) => void;
}) {
  const [people, setPeople] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!businessId) return;
    apiFetch<UserSummary[]>(`/api/v1/businesses/${businessId}/members/directory`)
      .then(setPeople)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load people"))
      .finally(() => setLoading(false));
  }, [businessId]);

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-card border border-gray-200 bg-white p-6 shadow-lg"
      >
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Start a direct message</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : error ? (
          <ErrorState message={error} />
        ) : (
          <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
            {people.map((p) => (
              <button
                key={p.id}
                onClick={() => onPick(p.id)}
                className="flex items-center gap-2 rounded-card px-2 py-2 text-left text-sm hover:bg-gray-50"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-white">
                  {initials(p.name)}
                </span>
                {p.name}
              </button>
            ))}
            {people.length === 0 && <p className="text-sm text-gray-400">No one else here yet</p>}
          </div>
        )}
        <button
          onClick={onClose}
          className="mt-4 w-full rounded-card border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function CreateChannelModal({
  businessId,
  onClose,
  onCreate,
}: {
  businessId: string | null;
  onClose: () => void;
  onCreate: (data: { name: string; description?: string; department?: string; memberIds: string[] }) => Promise<void>;
}) {
  const [people, setPeople] = useState<UserSummary[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [department, setDepartment] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!businessId) return;
    apiFetch<UserSummary[]>(`/api/v1/businesses/${businessId}/channels/assignable-members`)
      .then(setPeople)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load people"))
      .finally(() => setLoadingPeople(false));
  }, [businessId]);

  function toggleMember(userId: string) {
    setMemberIds((ids) => (ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onCreate({
        name,
        description: description || undefined,
        department: department || undefined,
        memberIds,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create channel");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-card border border-gray-200 bg-white p-6 shadow-lg"
      >
        <h2 className="mb-4 text-lg font-semibold text-gray-900">New channel</h2>

        <div className="flex flex-col gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Channel name"
            required
            className="rounded-card border border-gray-300 px-3 py-2 text-sm"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="rounded-card border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="Department label (optional)"
            className="rounded-card border border-gray-300 px-3 py-2 text-sm"
          />

          <div>
            <p className="mb-1 text-xs font-medium uppercase text-gray-400">Add members</p>
            {loadingPeople ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : (
              <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                {people.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 rounded-card px-1 py-1 text-sm hover:bg-gray-50">
                    <input type="checkbox" checked={memberIds.includes(p.id)} onChange={() => toggleMember(p.id)} />
                    {p.name}
                  </label>
                ))}
                {people.length === 0 && <p className="text-sm text-gray-400">No one eligible to add</p>}
              </div>
            )}
          </div>

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
              {saving ? "Creating…" : "Create"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
