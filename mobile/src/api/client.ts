import { API_BASE_URL } from "../config";
import type { ApiPreset, ApiWorkout } from "../sync/convert";

export class ApiError extends Error {
  status: number;
  // True when the request never reached the server (offline, DNS, timeout).
  network: boolean;

  constructor(status: number, message: string, network = false) {
    super(message);
    this.status = status;
    this.network = network;
  }
}

// The free-tier server can take close to a minute to wake up, so allow for that.
const TIMEOUT_MS = 60_000;

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {}
): Promise<T> {
  const { method = "GET", body, token } = options;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, "Could not reach the server. Check your connection and try again.", true);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    let detail = response.statusText || "Request failed";
    try {
      const data = await response.json();
      if (typeof data?.detail === "string") detail = data.detail;
      else if (Array.isArray(data?.detail) && data.detail[0]?.msg) detail = String(data.detail[0].msg);
    } catch {
      // not JSON; keep the status text
    }
    throw new ApiError(response.status, detail);
  }
  return (await response.json()) as T;
}

export interface SyncRequestBody {
  cursor: string | null;
  workouts: ApiWorkout[];
  presets: ApiPreset[];
  deleted_workouts: { id: string; updated_at: number }[];
  deleted_presets: { id: string; updated_at: number }[];
  settings?: { rest_timer_seconds: number; updated_at: number };
}

export interface SyncResponseBody {
  cursor: string;
  workouts: ApiWorkout[];
  presets: ApiPreset[];
  deleted_workouts: { id: string; updated_at: number }[];
  deleted_presets: { id: string; updated_at: number }[];
  settings: { rest_timer_seconds: number; updated_at: number } | null;
  token: string | null;
}

export interface Me {
  id: number;
  username: string;
  rest_timer_seconds: number;
}

export const api = {
  signup: (username: string, password: string) =>
    request<{ access_token: string }>("/auth/signup", { method: "POST", body: { username, password } }),
  login: (username: string, password: string) =>
    request<{ access_token: string }>("/auth/login", { method: "POST", body: { username, password } }),
  me: (token: string) => request<Me>("/auth/me", { token }),
  sync: (token: string, body: SyncRequestBody) =>
    request<SyncResponseBody>("/sync", { method: "POST", body, token }),
};
