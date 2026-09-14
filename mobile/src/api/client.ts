import { API_BASE_URL } from "../config";
import type { Exercise, Set, Token, Workout } from "./types";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {}
): Promise<T> {
  const { method = "GET", body, token } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      0,
      `Could not reach the server at ${API_BASE_URL}. Check EXPO_PUBLIC_API_URL and that the backend is running.`
    );
  }

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const data = await response.json();
      if (typeof data?.detail === "string") detail = data.detail;
    } catch {
      // response wasn't JSON; fall back to statusText
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  signup: (email: string, password: string) =>
    request<Token>("/auth/signup", { method: "POST", body: { email, password } }),

  login: (email: string, password: string) =>
    request<Token>("/auth/login", { method: "POST", body: { email, password } }),

  listWorkouts: (token: string) => request<Workout[]>("/workouts", { token }),

  createWorkout: (token: string, notes?: string) =>
    request<Workout>("/workouts", { method: "POST", body: { notes }, token }),

  addExercise: (token: string, workoutId: number, name: string, order = 0) =>
    request<Exercise>(`/workouts/${workoutId}/exercises`, {
      method: "POST",
      body: { name, order },
      token,
    }),

  logSet: (token: string, exerciseId: number, weight: number, reps: number) =>
    request<Set>(`/exercises/${exerciseId}/sets`, {
      method: "POST",
      body: { weight, reps },
      token,
    }),

  exerciseHistory: (token: string, exerciseId: number) =>
    request<Set[]>(`/exercises/${exerciseId}/history`, { token }),

  exerciseHistoryByName: (token: string, name: string) =>
    request<Set[]>(`/exercises/history?name=${encodeURIComponent(name)}`, { token }),
};
