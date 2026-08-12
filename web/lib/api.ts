import { getToken } from "./auth";

// Falls back to the real deployed API rather than localhost — Vercel builds don't have
// NEXT_PUBLIC_API_URL set (no way to configure that from here; it's a dashboard-only
// setting), and a localhost fallback baked into a production build is useless to a real
// browser. Local dev overrides this via .env.local (see .env.local.example).
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://full-stack-business-management-app.vercel.app";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body?.error?.message ?? res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
