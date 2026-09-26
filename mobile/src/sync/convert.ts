import type { Preset, Workout } from "../types";

// The API stores the same data in normalized tables, so its JSON is shaped a little differently
// from what the app keeps locally (no redundant parent ids, exercise order is implicit).

export interface ApiSet {
  id: string;
  set_number: number;
  weight: number;
  reps: number;
  completed_at: string;
}

export interface ApiExercise {
  id: string;
  name: string;
  plan: { sets: number; reps: number; weight: number } | null;
  sets: ApiSet[];
}

export interface ApiWorkout {
  id: string;
  date: string;
  name: string | null;
  notes: string | null;
  status: "planned" | "active" | "done";
  started_at: string | null;
  finished_at: string | null;
  rest: { ends_at: number; total: number } | null;
  updated_at: number;
  exercises: ApiExercise[];
}

export interface ApiPreset {
  id: string;
  name: string;
  updated_at: number;
  exercises: { name: string; sets: number; reps: number; weight: number }[];
}

export function toApiWorkout(w: Workout): ApiWorkout {
  return {
    id: w.id,
    date: w.date,
    name: w.name ?? null,
    notes: w.notes ?? null,
    status: w.status ?? "done",
    started_at: w.started_at ?? null,
    finished_at: w.finished_at ?? null,
    rest: w.rest ? { ends_at: w.rest.ends_at, total: w.rest.total } : null,
    updated_at: w.updated_at,
    exercises: w.exercises.map((e) => ({
      id: e.id,
      name: e.name,
      plan: e.plan ? { sets: e.plan.sets, reps: e.plan.reps, weight: e.plan.weight } : null,
      sets: e.sets.map((s) => ({
        id: s.id,
        set_number: s.set_number,
        weight: s.weight,
        reps: s.reps,
        completed_at: s.completed_at,
      })),
    })),
  };
}

export function fromApiWorkout(a: ApiWorkout): Workout {
  return {
    id: a.id,
    date: a.date,
    name: a.name,
    notes: a.notes,
    status: a.status,
    started_at: a.started_at,
    finished_at: a.finished_at,
    rest: a.rest,
    updated_at: a.updated_at,
    exercises: a.exercises.map((e, order) => ({
      id: e.id,
      workout_id: a.id,
      name: e.name,
      order,
      plan: e.plan,
      sets: e.sets.map((s) => ({ ...s, exercise_id: e.id })),
    })),
  };
}

export function toApiPreset(p: Preset): ApiPreset {
  return {
    id: p.id,
    name: p.name,
    updated_at: p.updated_at,
    exercises: p.exercises.map((e) => ({ name: e.name, sets: e.sets, reps: e.reps, weight: e.weight })),
  };
}

export function fromApiPreset(a: ApiPreset): Preset {
  return { id: a.id, name: a.name, updated_at: a.updated_at, exercises: a.exercises };
}
