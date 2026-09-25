import type { Exercise, Workout } from "../types";

export interface WorkoutProgress {
  // First exercise that still has sets left, in the order the workout was set up.
  current: Exercise | null;
  // 1-based number of the set to do next within the current exercise.
  setNumber: number;
  totalSets: number;
  doneSets: number;
}

export function getWorkoutProgress(workout: Workout): WorkoutProgress {
  let totalSets = 0;
  let doneSets = 0;
  let current: Exercise | null = null;
  for (const exercise of workout.exercises) {
    const planned = exercise.plan?.sets ?? exercise.sets.length;
    totalSets += planned;
    doneSets += Math.min(exercise.sets.length, planned);
    if (!current && exercise.sets.length < planned) current = exercise;
  }
  return { current, setNumber: current ? current.sets.length + 1 : 0, totalSets, doneSets };
}

export function workoutVolume(workout: Workout): number {
  return workout.exercises.reduce(
    (sum, e) => sum + e.sets.reduce((v, s) => v + s.weight * s.reps, 0),
    0
  );
}

export function describeTarget(exercise: Exercise, setNumber: number, weight: number, reps: number): string {
  const total = exercise.plan?.sets ?? setNumber;
  return `${exercise.name} · set ${setNumber} of ${total} · ${weight} lb × ${reps}`;
}

// What comes next once one more set of `exerciseId` has been logged (null if the workout is over).
export function describeNextAfterSet(workout: Workout, exerciseId: number): string | null {
  const simulated: Workout = {
    ...workout,
    exercises: workout.exercises.map((e) =>
      e.id === exerciseId ? { ...e, sets: [...e.sets, e.sets[e.sets.length - 1] ?? ({} as never)] } : e
    ),
  };
  const next = getWorkoutProgress(simulated);
  if (!next.current?.plan) return null;
  const last = next.current.sets[next.current.sets.length - 1];
  return describeTarget(
    next.current,
    next.setNumber,
    last?.weight ?? next.current.plan.weight,
    next.current.plan.reps
  );
}
