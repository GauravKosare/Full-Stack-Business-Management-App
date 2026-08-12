import { Platform } from "react-native";
import { getToken } from "./auth";

// Android emulator can't reach "localhost" (that resolves to the emulator itself) —
// 10.0.2.2 is the documented alias for the host machine. iOS simulator can use
// localhost directly. A real device needs the host machine's LAN IP, set via
// EXPO_PUBLIC_API_URL in .env (Expo exposes EXPO_PUBLIC_* vars to client code).
const DEFAULT_API_URL = Platform.OS === "android" ? "http://10.0.2.2:3000" : "http://localhost:3000";
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL;

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
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
