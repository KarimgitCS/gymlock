import { STARTER_PRESETS } from "../presets/starters";
import { emptyState, type CollectionState } from "../sync/collection";
import type { Preset, Workout } from "../types";
import { newId } from "../utils/id";

// Before sync existed, ids were per-device counters (1, 2, 3, ...), which would collide across
// devices. These convert that older on-device data to UUIDs once, on first load.

interface LegacyWorkouts {
  workouts: Array<Omit<Workout, "id" | "updated_at" | "exercises"> & {
    id: number;
    exercises: Array<{ id: number; workout_id: number; sets: Array<{ id: number; exercise_id: number; completed_at: string }> }>;
  }>;
}

interface LegacyPresets {
  presets: Array<{ id: number; name: string; exercises: Preset["exercises"] }>;
}

export function migrateWorkouts(legacy: LegacyWorkouts): CollectionState<Workout> {
  const ids = new Map<number, string>();
  const map = (old: number) => {
    if (!ids.has(old)) ids.set(old, newId());
    return ids.get(old)!;
  };

  const items = legacy.workouts.map((w) => {
    const times = [
      w.finished_at,
      w.started_at,
      ...w.exercises.flatMap((e) => e.sets.map((s) => s.completed_at)),
    ]
      .filter((t): t is string => typeof t === "string")
      .map((t) => Date.parse(t))
      .filter((t) => Number.isFinite(t));
    const workoutId = map(w.id);
    return {
      ...w,
      id: workoutId,
      status: w.status ?? ("done" as const),
      updated_at: times.length ? Math.max(...times) : Date.now(),
      exercises: w.exercises.map((e, order) => {
        const exerciseId = map(e.id);
        return {
          ...e,
          id: exerciseId,
          workout_id: workoutId,
          order,
          sets: e.sets.map((s) => ({ ...s, id: map(s.id), exercise_id: exerciseId })),
        };
      }),
    } as unknown as Workout;
  });
  return { ...emptyState<Workout>(), items };
}

export function migratePresets(legacy: LegacyPresets): CollectionState<Preset> {
  const items: Preset[] = legacy.presets.map((p) => {
    const starter = STARTER_PRESETS.find(
      (s) => s.name === p.name && JSON.stringify(s.exercises) === JSON.stringify(p.exercises)
    );
    // An untouched starter keeps its shared id so it merges with the same starter elsewhere.
    if (starter) return starter;
    return { id: newId(), name: p.name, exercises: p.exercises, updated_at: Date.now() };
  });
  return { ...emptyState<Preset>(), items };
}
