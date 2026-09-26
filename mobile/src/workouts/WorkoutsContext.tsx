import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type PropsWithChildren,
} from "react";

import { migrateWorkouts } from "../storage/legacy";
import { loadJson } from "../storage/storage";
import {
  deleteLocal,
  emptyState,
  nextStamp,
  upsertLocal,
  type CollectionState,
} from "../sync/collection";
import { useSyncedCollection } from "../sync/useSyncedCollection";
import type { Exercise, ExercisePlan, Preset, RestState, Set, Workout } from "../types";
import { newId } from "../utils/id";

const WORKOUTS_KEY = "gymlock_workouts_v2";
const LEGACY_WORKOUTS_KEY = "gymlock_workouts_v1";

interface WorkoutsContextValue {
  workouts: Workout[];
  isLoading: boolean;
  // The workout that is being set up or is in progress, if any.
  openWorkout: Workout | undefined;
  getWorkout: (id: string) => Workout | undefined;
  getSetsForExercise: (name: string) => Set[];
  createWorkout: () => Promise<Workout>;
  createWorkoutFromPreset: (preset: Preset) => Promise<Workout>;
  addExercise: (workoutId: string, name: string, plan: ExercisePlan) => Promise<Exercise>;
  updateExercise: (
    workoutId: string,
    exerciseId: string,
    patch: { name?: string; plan?: ExercisePlan }
  ) => Promise<void>;
  removeExercise: (workoutId: string, exerciseId: string) => Promise<void>;
  deleteWorkout: (workoutId: string) => Promise<void>;
  beginWorkout: (workoutId: string) => Promise<void>;
  completeSet: (
    workoutId: string,
    exerciseId: string,
    weight: number,
    reps: number,
    restSeconds: number
  ) => Promise<{ finished: boolean }>;
  setRest: (workoutId: string, rest: RestState | null) => Promise<void>;
  finishWorkout: (workoutId: string) => Promise<void>;
}

const WorkoutsContext = createContext<WorkoutsContextValue | null>(null);

function todayLocalIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

const isOpen = (w: Workout) => w.status === "planned" || w.status === "active";

async function loadWorkouts(): Promise<CollectionState<Workout>> {
  const stored = await loadJson<CollectionState<Workout>>(WORKOUTS_KEY);
  if (stored) return stored;
  const legacy = await loadJson<Parameters<typeof migrateWorkouts>[0]>(LEGACY_WORKOUTS_KEY);
  return legacy ? migrateWorkouts(legacy) : emptyState<Workout>();
}

export function WorkoutsProvider({ children }: PropsWithChildren) {
  const { items: workouts, isLoading, ref, update } = useSyncedCollection<Workout>({
    name: "workouts",
    storageKey: WORKOUTS_KEY,
    load: loadWorkouts,
    fresh: () => emptyState<Workout>(),
  });

  // Apply an edit to one workout and stamp it so it wins over older copies on other devices.
  const mutate = useCallback(
    (workoutId: string, edit: (w: Workout) => Workout) => {
      const current = ref.current.items.find((w) => w.id === workoutId);
      if (!current) return undefined;
      const next = { ...edit(current), updated_at: nextStamp(current.updated_at) };
      update(upsertLocal(ref.current, next));
      return next;
    },
    [ref, update]
  );

  // Only one workout can be open at a time: unfinished drafts are dropped and any workout still
  // in progress is closed out, keeping what was logged so progress charts stay accurate.
  const closeOpenWorkouts = useCallback(
    (state: CollectionState<Workout>): CollectionState<Workout> => {
      let next = state;
      for (const w of state.items) {
        if (w.status === "planned") next = deleteLocal(next, w.id);
        else if (w.status === "active") {
          next = upsertLocal(next, {
            ...w,
            status: "done",
            finished_at: new Date().toISOString(),
            rest: null,
            updated_at: nextStamp(w.updated_at),
          });
        }
      }
      return next;
    },
    []
  );

  const openWorkout = useMemo(() => workouts.find(isOpen), [workouts]);
  const getWorkout = useCallback((id: string) => workouts.find((w) => w.id === id), [workouts]);

  const getSetsForExercise = useCallback(
    (name: string) => {
      const wanted = name.trim().toLowerCase();
      const sets: Set[] = [];
      for (const workout of workouts) {
        for (const exercise of workout.exercises) {
          if (exercise.name.trim().toLowerCase() === wanted) sets.push(...exercise.sets);
        }
      }
      return sets.sort((a, b) => Date.parse(a.completed_at) - Date.parse(b.completed_at));
    },
    [workouts]
  );

  const createWorkout = useCallback(async () => {
    const workout: Workout = {
      id: newId(),
      date: todayLocalIso(),
      name: null,
      notes: null,
      status: "planned",
      started_at: null,
      finished_at: null,
      rest: null,
      updated_at: Date.now(),
      exercises: [],
    };
    update(upsertLocal(closeOpenWorkouts(ref.current), workout));
    return workout;
  }, [closeOpenWorkouts, ref, update]);

  const createWorkoutFromPreset = useCallback(
    async (preset: Preset) => {
      const id = newId();
      const workout: Workout = {
        id,
        date: todayLocalIso(),
        name: preset.name,
        notes: null,
        status: "planned",
        started_at: null,
        finished_at: null,
        rest: null,
        updated_at: Date.now(),
        exercises: preset.exercises.map((e, order) => ({
          id: newId(),
          workout_id: id,
          name: e.name,
          order,
          plan: { sets: e.sets, reps: e.reps, weight: e.weight },
          sets: [],
        })),
      };
      update(upsertLocal(closeOpenWorkouts(ref.current), workout));
      return workout;
    },
    [closeOpenWorkouts, ref, update]
  );

  const addExercise = useCallback(
    async (workoutId: string, name: string, plan: ExercisePlan) => {
      const exercise: Exercise = {
        id: newId(),
        workout_id: workoutId,
        name,
        order: 0,
        plan,
        sets: [],
      };
      const result = mutate(workoutId, (w) => ({
        ...w,
        exercises: [...w.exercises, { ...exercise, order: w.exercises.length }],
      }));
      if (!result) throw new Error("Workout not found");
      return result.exercises[result.exercises.length - 1];
    },
    [mutate]
  );

  const updateExercise = useCallback(
    async (workoutId: string, exerciseId: string, patch: { name?: string; plan?: ExercisePlan }) => {
      mutate(workoutId, (w) => ({
        ...w,
        exercises: w.exercises.map((e) => (e.id === exerciseId ? { ...e, ...patch } : e)),
      }));
    },
    [mutate]
  );

  const removeExercise = useCallback(
    async (workoutId: string, exerciseId: string) => {
      mutate(workoutId, (w) => ({
        ...w,
        exercises: w.exercises.filter((e) => e.id !== exerciseId).map((e, order) => ({ ...e, order })),
      }));
    },
    [mutate]
  );

  const deleteWorkout = useCallback(
    async (workoutId: string) => {
      update(deleteLocal(ref.current, workoutId));
    },
    [ref, update]
  );

  const beginWorkout = useCallback(
    async (workoutId: string) => {
      mutate(workoutId, (w) => ({
        ...w,
        status: "active",
        started_at: new Date().toISOString(),
        rest: null,
      }));
    },
    [mutate]
  );

  // Logs the set and, only because the user pressed "Set done", starts the rest that follows it.
  const completeSet = useCallback(
    async (workoutId: string, exerciseId: string, weight: number, reps: number, restSeconds: number) => {
      const workout = ref.current.items.find((w) => w.id === workoutId);
      const exercise = workout?.exercises.find((e) => e.id === exerciseId);
      if (!workout || !exercise) throw new Error("Workout not found");

      const newSet: Set = {
        id: newId(),
        exercise_id: exerciseId,
        weight,
        reps,
        set_number: exercise.sets.length + 1,
        completed_at: new Date().toISOString(),
      };
      const exercises = workout.exercises.map((e) =>
        e.id === exerciseId ? { ...e, sets: [...e.sets, newSet] } : e
      );
      const finished = exercises.every((e) => !e.plan || e.sets.length >= e.plan.sets);

      mutate(workoutId, (w) => ({
        ...w,
        exercises,
        ...(finished
          ? { status: "done" as const, finished_at: new Date().toISOString(), rest: null }
          : { rest: { ends_at: Date.now() + restSeconds * 1000, total: restSeconds } }),
      }));
      return { finished };
    },
    [mutate, ref]
  );

  const setRest = useCallback(
    async (workoutId: string, rest: RestState | null) => {
      mutate(workoutId, (w) => ({ ...w, rest }));
    },
    [mutate]
  );

  const finishWorkout = useCallback(
    async (workoutId: string) => {
      mutate(workoutId, (w) => ({
        ...w,
        status: "done",
        finished_at: new Date().toISOString(),
        rest: null,
      }));
    },
    [mutate]
  );

  const value = useMemo<WorkoutsContextValue>(
    () => ({
      workouts,
      isLoading,
      openWorkout,
      getWorkout,
      getSetsForExercise,
      createWorkout,
      createWorkoutFromPreset,
      addExercise,
      updateExercise,
      removeExercise,
      deleteWorkout,
      beginWorkout,
      completeSet,
      setRest,
      finishWorkout,
    }),
    [
      workouts,
      isLoading,
      openWorkout,
      getWorkout,
      getSetsForExercise,
      createWorkout,
      createWorkoutFromPreset,
      addExercise,
      updateExercise,
      removeExercise,
      deleteWorkout,
      beginWorkout,
      completeSet,
      setRest,
      finishWorkout,
    ]
  );

  return <WorkoutsContext.Provider value={value}>{children}</WorkoutsContext.Provider>;
}

export function useWorkouts(): WorkoutsContextValue {
  const ctx = useContext(WorkoutsContext);
  if (!ctx) throw new Error("useWorkouts must be used within a WorkoutsProvider");
  return ctx;
}
