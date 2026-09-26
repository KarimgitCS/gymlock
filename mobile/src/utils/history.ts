import type { Workout } from "../types";
import { formatDate } from "./date";
import { getWorkoutProgress, workoutVolume } from "./workoutProgress";

// Workouts saved before setup/active modes existed have no status and count as finished.
export const isFinished = (w: Workout) => (w.status ?? "done") === "done";

export interface HistoryEntry {
  workout: Workout;
  sets: number;
  volume: number;
  minutes: number | null;
  // Finished with sets still left in the plan (ended early, or closed out by starting another workout).
  endedEarly: boolean;
  plannedSets: number;
}

function minutesBetween(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  return Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 60000));
}

function sortTime(w: Workout): number {
  const stamp = Date.parse(w.finished_at ?? w.started_at ?? "");
  return Number.isNaN(stamp) ? Date.parse(`${w.date}T00:00:00`) : stamp;
}

export function describeEntry(workout: Workout): HistoryEntry {
  const progress = getWorkoutProgress(workout);
  return {
    workout,
    sets: workout.exercises.reduce((sum, e) => sum + e.sets.length, 0),
    volume: Math.round(workoutVolume(workout)),
    minutes: minutesBetween(workout.started_at, workout.finished_at),
    endedEarly: progress.totalSets > 0 && progress.doneSets < progress.totalSets,
    plannedSets: progress.totalSets,
  };
}

// The workout log: finished workouts, newest first. The one being set up or in progress is not
// part of it yet (it shows on the home screen instead).
export function historyEntries(workouts: Workout[]): HistoryEntry[] {
  return workouts
    .filter(isFinished)
    .sort((a, b) => sortTime(b) - sortTime(a))
    .map(describeEntry);
}

// "Fri, Sep 25 · 6:42 PM" (the time is omitted for workouts that never recorded one).
export function formatWorkoutWhen(workout: Workout): string {
  const stamp = Date.parse(workout.started_at ?? workout.finished_at ?? "");
  const day = formatDate(workout.date);
  if (Number.isNaN(stamp)) return day;
  const time = new Date(stamp).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
}
