import assert from "node:assert/strict";
import { test } from "node:test";

import type { Workout } from "../types";
import { describeEntry, historyEntries, isFinished } from "./history";

function workout(id: string, over: Partial<Workout> = {}, sets = 2, planned = 2): Workout {
  return {
    id,
    date: "2026-09-25",
    name: "Push Day",
    notes: null,
    status: "done",
    started_at: "2026-09-25T15:00:00.000Z",
    finished_at: "2026-09-25T15:30:00.000Z",
    rest: null,
    updated_at: 1,
    exercises: [
      {
        id: `${id}-e`,
        workout_id: id,
        name: "Bench Press",
        order: 0,
        plan: { sets: planned, reps: 8, weight: 100 },
        sets: Array.from({ length: sets }, (_, i) => ({
          id: `${id}-s${i}`,
          exercise_id: `${id}-e`,
          weight: 100,
          reps: 8,
          set_number: i + 1,
          completed_at: "2026-09-25T15:10:00.000Z",
        })),
      },
    ],
    ...over,
  };
}

test("the log lists finished workouts only, newest first", () => {
  const older = workout("older", { finished_at: "2026-09-20T10:00:00.000Z", date: "2026-09-20" });
  const newer = workout("newer");
  const planned = workout("planned", { status: "planned" });
  const active = workout("active", { status: "active", finished_at: null });
  const ids = historyEntries([older, planned, newer, active]).map((e) => e.workout.id);
  assert.deepEqual(ids, ["newer", "older"]);
});

test("a workout saved before statuses existed counts as finished", () => {
  const legacy = workout("legacy", { status: undefined });
  assert.equal(isFinished(legacy), true);
  assert.equal(historyEntries([legacy]).length, 1);
});

test("a finished workout with sets left in the plan is marked as ended early", () => {
  assert.equal(describeEntry(workout("full", {}, 3, 3)).endedEarly, false);
  const partial = describeEntry(workout("partial", {}, 1, 3));
  assert.equal(partial.endedEarly, true);
  assert.equal(partial.sets, 1);
  assert.equal(partial.plannedSets, 3);
});

test("a workout with nothing planned is never called ended early", () => {
  const blank = workout("blank", {}, 0, 0);
  blank.exercises = [];
  assert.equal(describeEntry(blank).endedEarly, false);
});

test("entries report volume and duration", () => {
  const entry = describeEntry(workout("w", {}, 2, 2));
  assert.equal(entry.volume, 1600);
  assert.equal(entry.minutes, 30);
  assert.equal(describeEntry(workout("x", { finished_at: null })).minutes, null);
});

test("without timestamps the calendar date still orders the log", () => {
  const a = workout("a", { started_at: null, finished_at: null, date: "2026-09-01" });
  const b = workout("b", { started_at: null, finished_at: null, date: "2026-09-10" });
  assert.deepEqual(historyEntries([a, b]).map((e) => e.workout.id), ["b", "a"]);
});
