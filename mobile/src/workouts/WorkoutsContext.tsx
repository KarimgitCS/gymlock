import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import { api } from "../api/client";
import type { Exercise, Set, Workout } from "../api/types";
import { useAuth } from "../auth/AuthContext";

interface WorkoutsContextValue {
  workouts: Workout[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getWorkout: (id: number) => Workout | undefined;
  createWorkout: (notes?: string) => Promise<Workout>;
  addExercise: (workoutId: number, name: string) => Promise<Exercise>;
  logSet: (exerciseId: number, weight: number, reps: number) => Promise<Set>;
}

const WorkoutsContext = createContext<WorkoutsContextValue | null>(null);

export function WorkoutsProvider({ children }: PropsWithChildren) {
  const { token } = useAuth();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      setWorkouts(await api.listWorkouts(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workouts");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) refresh();
    else setWorkouts([]);
  }, [token, refresh]);

  const getWorkout = useCallback(
    (id: number) => workouts.find((w) => w.id === id),
    [workouts]
  );

  const createWorkout = useCallback(
    async (notes?: string) => {
      if (!token) throw new Error("Not authenticated");
      const workout = await api.createWorkout(token, notes);
      setWorkouts((prev) => [workout, ...prev]);
      return workout;
    },
    [token]
  );

  const addExercise = useCallback(
    async (workoutId: number, name: string) => {
      if (!token) throw new Error("Not authenticated");
      const workout = workouts.find((w) => w.id === workoutId);
      const order = workout ? workout.exercises.length : 0;
      const exercise = await api.addExercise(token, workoutId, name, order);
      setWorkouts((prev) =>
        prev.map((w) =>
          w.id === workoutId ? { ...w, exercises: [...w.exercises, exercise] } : w
        )
      );
      return exercise;
    },
    [token, workouts]
  );

  const logSet = useCallback(
    async (exerciseId: number, weight: number, reps: number) => {
      if (!token) throw new Error("Not authenticated");
      const newSet = await api.logSet(token, exerciseId, weight, reps);
      setWorkouts((prev) =>
        prev.map((w) => ({
          ...w,
          exercises: w.exercises.map((e) =>
            e.id === exerciseId ? { ...e, sets: [...e.sets, newSet] } : e
          ),
        }))
      );
      return newSet;
    },
    [token]
  );

  const value = useMemo<WorkoutsContextValue>(
    () => ({
      workouts,
      isLoading,
      error,
      refresh,
      getWorkout,
      createWorkout,
      addExercise,
      logSet,
    }),
    [workouts, isLoading, error, refresh, getWorkout, createWorkout, addExercise, logSet]
  );

  return (
    <WorkoutsContext.Provider value={value}>{children}</WorkoutsContext.Provider>
  );
}

export function useWorkouts(): WorkoutsContextValue {
  const ctx = useContext(WorkoutsContext);
  if (!ctx) throw new Error("useWorkouts must be used within a WorkoutsProvider");
  return ctx;
}
