import assert from "node:assert/strict";
import { test } from "node:test";

import type { Preset, Workout } from "../types";
import { fromApiPreset, fromApiWorkout, toApiPreset, toApiWorkout } from "./convert";

const workout: Workout = {
  id: "w1",
  date: "2026-09-25",
  name: "Push Day",
  notes: null,
  status: "active",
  started_at: "2026-09-25T15:00:00.000Z",
  finished_at: null,
  rest: { ends_at: 1790000000000, total: 90 },
  updated_at: 1234,
  exercises: [
    {
      id: "e1",
      workout_id: "w1",
      name: "Bench Press",
      order: 0,
      plan: { sets: 4, reps: 8, weight: 135 },
      sets: [{ id: "s1", exercise_id: "e1", weight: 135, reps: 8, set_number: 1, completed_at: "2026-09-25T15:05:00.000Z" }],
    },
    { id: "e2", workout_id: "w1", name: "Dips", order: 1, plan: null, sets: [] },
  ],
};

test("a workout survives a round trip through the API format unchanged", () => {
  assert.deepEqual(fromApiWorkout(toApiWorkout(workout)), workout);
});

test("workouts saved before stages existed are sent as done", () => {
  const { status: _status, ...legacy } = workout;
  assert.equal(toApiWorkout(legacy as Workout).status, "done");
});

test("the API payload carries no redundant parent ids", () => {
  const api = toApiWorkout(workout);
  assert.equal("workout_id" in api.exercises[0], false);
  assert.equal("exercise_id" in api.exercises[0].sets[0], false);
});

test("exercise order follows the order the API returns them in", () => {
  const back = fromApiWorkout(toApiWorkout(workout));
  assert.deepEqual(back.exercises.map((e) => e.order), [0, 1]);
});

test("a preset survives a round trip", () => {
  const preset: Preset = {
    id: "p1",
    name: "Arm Day",
    updated_at: 99,
    exercises: [{ name: "Curl", sets: 3, reps: 10, weight: 30 }],
  };
  assert.deepEqual(fromApiPreset(toApiPreset(preset)), preset);
});
