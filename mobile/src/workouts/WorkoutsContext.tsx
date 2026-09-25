import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

import { loadJson, saveJson } from "../storage/storage";
import type { Exercise, ExercisePlan, Preset, RestState, Set, Workout } from "../types";

const WORKOUTS_KEY = "gymlock_workouts_v1";

interface StoredWorkouts {
  nextId: number;
  workouts: Workout[];
}

interface WorkoutsContextValue {
  workouts: Workout[];
  isLoading: boolean;
  // The workout that is being set up or is in progress, if any.
  openWorkout: Workout | undefined;
  getWorkout: (id: number) => Workout | undefined;
  getSetsForExercise: (name: string) => Set[];
  createWorkout: () => Promise<Workout>;
  createWorkoutFromPreset: (preset: Preset) => Promise<Workout>;
  addExercise: (workoutId: number, name: string, plan: ExercisePlan) => Promise<Exercise>;
  updateExercise: (
    workoutId: number,
    exerciseId: number,
    patch: { name?: string; plan?: ExercisePlan }
  ) => Promise<void>;
  removeExercise: (workoutId: number, exerciseId: number) => Promise<void>;
  deleteWorkout: (workoutId: number) => Promise<void>;
  beginWorkout: (workoutId: number) => Promise<void>;
  completeSet: (
    workoutId: number,
    exerciseId: number,
    weight: number,
    reps: number,
    restSeconds: number
  ) => Promise<{ finished: boolean }>;
  setRest: (workoutId: number, rest: RestState | null) => Promise<void>;
  finishWorkout: (workoutId: number) => Promise<void>;
}

const WorkoutsContext = createContext<WorkoutsContextValue | null>(null);

function todayLocalIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

const isOpen = (w: Workout) => w.status === "planned" || w.status === "active";

export function WorkoutsProvider({ children }: PropsWithChildren) {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // The ref is the source of truth so back-to-back actions never read stale state.
  const workoutsRef = useRef<Workout[]>([]);
  const nextIdRef = useRef(1);

  useEffect(() => {
    loadJson<StoredWorkouts>(WORKOUTS_KEY).then((stored) => {
      if (stored) {
        workoutsRef.current = stored.workouts;
        nextIdRef.current = stored.nextId;
        setWorkouts(stored.workouts);
      }
      setIsLoading(false);
    });
  }, []);

  const commit = useCallback((next: Workout[]) => {
    workoutsRef.current = next;
    setWorkouts(next);
    saveJson(WORKOUTS_KEY, { nextId: nextIdRef.current, workouts: next } satisfies StoredWorkouts);
  }, []);

  const patchWorkout = useCallback(
    (workoutId: number, fn: (w: Workout) => Workout) =>
      commit(workoutsRef.current.map((w) => (w.id === workoutId ? fn(w) : w))),
    [commit]
  );

  // Only one workout can be open at a time: unfinished drafts are dropped and any workout still
  // in progress is closed out, keeping what was logged so progress charts stay accurate.
  const closeOpenWorkouts = useCallback((list: Workout[]): Workout[] => {
    const finishedAt = new Date().toISOString();
    return list
      .filter((w) => !(w.status === "planned"))
      .map((w) =>
        w.status === "active" ? { ...w, status: "done" as const, finished_at: finishedAt, rest: null } : w
      );
  }, []);

  const getWorkout = useCallback((id: number) => workouts.find((w) => w.id === id), [workouts]);

  const openWorkout = useMemo(() => workouts.find(isOpen), [workouts]);

  const getSetsForExercise = useCallback(
    (name: string) => {
      const wanted = name.trim().toLowerCase();
      const sets: Set[] = [];
      for (const workout of workouts) {
        for (const exercise of workout.exercises) {
          if (exercise.name.trim().toLowerCase() === wanted) sets.push(...exercise.sets);
        }
      }
      return sets.sort(
        (a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime()
      );
    },
    [workouts]
  );

  const createWorkout = useCallback(async () => {
    const workout: Workout = {
      id: nextIdRef.current++,
      date: todayLocalIso(),
      name: null,
      notes: null,
      status: "planned",
      started_at: null,
      finished_at: null,
      rest: null,
      exercises: [],
    };
    commit([workout, ...closeOpenWorkouts(workoutsRef.current)]);
    return workout;
  }, [commit, closeOpenWorkouts]);

  const createWorkoutFromPreset = useCallback(
    async (preset: Preset) => {
      const id = nextIdRef.current++;
      const workout: Workout = {
        id,
        date: todayLocalIso(),
        name: preset.name,
        notes: null,
        status: "planned",
        started_at: null,
        finished_at: null,
        rest: null,
        exercises: preset.exercises.map((e, order) => ({
          id: nextIdRef.current++,
          workout_id: id,
          name: e.name,
          order,
          plan: { sets: e.sets, reps: e.reps, weight: e.weight },
          sets: [],
        })),
      };
      commit([workout, ...closeOpenWorkouts(workoutsRef.current)]);
      return workout;
    },
    [commit, closeOpenWorkouts]
  );

  const addExercise = useCallback(
    async (workoutId: number, name: string, plan: ExercisePlan) => {
      const workout = workoutsRef.current.find((w) => w.id === workoutId);
      if (!workout) throw new Error("Workout not found");
      const exercise: Exercise = {
        id: nextIdRef.current++,
        workout_id: workoutId,
        name,
        order: workout.exercises.length,
        plan,
        sets: [],
      };
      patchWorkout(workoutId, (w) => ({ ...w, exercises: [...w.exercises, exercise] }));
      return exercise;
    },
    [patchWorkout]
  );

  const updateExercise = useCallback(
    async (workoutId: number, exerciseId: number, patch: { name?: string; plan?: ExercisePlan }) => {
      patchWorkout(workoutId, (w) => ({
        ...w,
        exercises: w.exercises.map((e) => (e.id === exerciseId ? { ...e, ...patch } : e)),
      }));
    },
    [patchWorkout]
  );

  const removeExercise = useCallback(
    async (workoutId: number, exerciseId: number) => {
      patchWorkout(workoutId, (w) => ({
        ...w,
        exercises: w.exercises
          .filter((e) => e.id !== exerciseId)
          .map((e, order) => ({ ...e, order })),
      }));
    },
    [patchWorkout]
  );

  const deleteWorkout = useCallback(
    async (workoutId: number) => {
      commit(workoutsRef.current.filter((w) => w.id !== workoutId));
    },
    [commit]
  );

  const beginWorkout = useCallback(
    async (workoutId: number) => {
      patchWorkout(workoutId, (w) => ({
        ...w,
        status: "active",
        started_at: new Date().toISOString(),
        rest: null,
      }));
    },
    [patchWorkout]
  );

  // Logs the set and, only because the user pressed "Set done", starts the rest that follows it.
  const completeSet = useCallback(
    async (workoutId: number, exerciseId: number, weight: number, reps: number, restSeconds: number) => {
      const workout = workoutsRef.current.find((w) => w.id === workoutId);
      if (!workout) throw new Error("Workout not found");
      const exercise = workout.exercises.find((e) => e.id === exerciseId);
      if (!exercise) throw new Error("Exercise not found");

      const newSet: Set = {
        id: nextIdRef.current++,
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

      patchWorkout(workoutId, (w) => ({
        ...w,
        exercises,
        ...(finished
          ? { status: "done" as const, finished_at: new Date().toISOString(), rest: null }
          : { rest: { ends_at: Date.now() + restSeconds * 1000, total: restSeconds } }),
      }));
      return { finished };
    },
    [patchWorkout]
  );

  const setRest = useCallback(
    async (workoutId: number, rest: RestState | null) => {
      patchWorkout(workoutId, (w) => ({ ...w, rest }));
    },
    [patchWorkout]
  );

  const finishWorkout = useCallback(
    async (workoutId: number) => {
      patchWorkout(workoutId, (w) => ({
        ...w,
        status: "done",
        finished_at: new Date().toISOString(),
        rest: null,
      }));
    },
    [patchWorkout]
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
