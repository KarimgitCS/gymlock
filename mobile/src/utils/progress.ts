import type { Set as LoggedSet } from "../types";

export interface SessionPoint {
  exerciseId: string;
  date: Date;
  maxWeight: number;
  volume: number;
}

/**
 * Each `Exercise` row (and its sets) belongs to a single workout, so grouping by
 * exercise_id recovers one point per workout session for a given exercise name.
 */
export function groupSetsBySession(sets: LoggedSet[]): SessionPoint[] {
  const byExercise = new Map<string, LoggedSet[]>();
  for (const s of sets) {
    const list = byExercise.get(s.exercise_id) ?? [];
    list.push(s);
    byExercise.set(s.exercise_id, list);
  }

  const sessions: SessionPoint[] = [];
  for (const [exerciseId, exerciseSets] of byExercise) {
    const maxWeight = Math.max(...exerciseSets.map((s) => s.weight));
    const volume = exerciseSets.reduce((sum, s) => sum + s.weight * s.reps, 0);
    const earliest = exerciseSets.reduce(
      (min, s) => Math.min(min, new Date(s.completed_at).getTime()),
      new Date(exerciseSets[0].completed_at).getTime()
    );
    sessions.push({ exerciseId, date: new Date(earliest), maxWeight, volume });
  }

  sessions.sort((a, b) => a.date.getTime() - b.date.getTime());
  return sessions;
}
