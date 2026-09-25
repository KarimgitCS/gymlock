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

import type { Exercise, Preset, Set, Workout } from "../types";
import { loadJson, saveJson } from "../storage/storage";

const WORKOUTS_KEY = "gymlock_workouts_v1";

interface StoredWorkouts {
  nextId: number;
  workouts: Workout[];
}

interface WorkoutsContextValue {
  workouts: Workout[];
  isLoading: boolean;
  getWorkout: (id: number) => Workout | undefined;
  getSetsForExercise: (name: string) => Set[];
  createWorkout: () => Promise<Workout>;
  createWorkoutFromPreset: (preset: Preset) => Promise<Workout>;
  addExercise: (workoutId: number, name: string) => Promise<Exercise>;
  logSet: (exerciseId: number, weight: number, reps: number) => Promise<Set>;
}

const WorkoutsContext = createContext<WorkoutsContextValue | null>(null);

function todayLocalIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

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

  const getWorkout = useCallback(
    (id: number) => workouts.find((w) => w.id === id),
    [workouts]
  );

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
      exercises: [],
    };
    commit([workout, ...workoutsRef.current]);
    return workout;
  }, [commit]);

  const createWorkoutFromPreset = useCallback(
    async (preset: Preset) => {
      const id = nextIdRef.current++;
      const workout: Workout = {
        id,
        date: todayLocalIso(),
        name: preset.name,
        notes: null,
        exercises: preset.exercises.map((e, order) => ({
          id: nextIdRef.current++,
          workout_id: id,
          name: e.name,
          order,
          plan: { sets: e.sets, reps: e.reps, weight: e.weight },
          sets: [],
        })),
      };
      commit([workout, ...workoutsRef.current]);
      return workout;
    },
    [commit]
  );

  const addExercise = useCallback(
    async (workoutId: number, name: string) => {
      const workout = workoutsRef.current.find((w) => w.id === workoutId);
      if (!workout) throw new Error("Workout not found");
      const exercise: Exercise = {
        id: nextIdRef.current++,
        workout_id: workoutId,
        name,
        order: workout.exercises.length,
        sets: [],
      };
      commit(
        workoutsRef.current.map((w) =>
          w.id === workoutId ? { ...w, exercises: [...w.exercises, exercise] } : w
        )
      );
      return exercise;
    },
    [commit]
  );

  const logSet = useCallback(
    async (exerciseId: number, weight: number, reps: number) => {
      let created: Set | null = null;
      const next = workoutsRef.current.map((w) => ({
        ...w,
        exercises: w.exercises.map((e) => {
          if (e.id !== exerciseId) return e;
          created = {
            id: nextIdRef.current++,
            exercise_id: exerciseId,
            weight,
            reps,
            set_number: e.sets.length + 1,
            completed_at: new Date().toISOString(),
          };
          return { ...e, sets: [...e.sets, created] };
        }),
      }));
      if (!created) throw new Error("Exercise not found");
      commit(next);
      return created;
    },
    [commit]
  );

  const value = useMemo<WorkoutsContextValue>(
    () => ({
      workouts,
      isLoading,
      getWorkout,
      getSetsForExercise,
      createWorkout,
      createWorkoutFromPreset,
      addExercise,
      logSet,
    }),
    [
      workouts,
      isLoading,
      getWorkout,
      getSetsForExercise,
      createWorkout,
      createWorkoutFromPreset,
      addExercise,
      logSet,
    ]
  );

  return <WorkoutsContext.Provider value={value}>{children}</WorkoutsContext.Provider>;
}

export function useWorkouts(): WorkoutsContextValue {
  const ctx = useContext(WorkoutsContext);
  if (!ctx) throw new Error("useWorkouts must be used within a WorkoutsProvider");
  return ctx;
}
