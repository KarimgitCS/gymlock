import assert from "node:assert/strict";
import { test } from "node:test";

import { STARTER_PRESETS } from "../presets/starters";
import { migratePresets, migrateWorkouts } from "./legacy";

const legacyWorkouts = {
  nextId: 20,
  workouts: [
    {
      id: 1,
      date: "2026-09-20",
      name: "Push Day",
      notes: null,
      status: "done" as const,
      started_at: "2026-09-20T10:00:00.000Z",
      finished_at: "2026-09-20T10:45:00.000Z",
      exercises: [
        {
          id: 2,
          workout_id: 1,
          name: "Bench Press",
          order: 0,
          sets: [{ id: 3, exercise_id: 2, weight: 135, reps: 8, set_number: 1, completed_at: "2026-09-20T10:10:00.000Z" }],
        },
      ],
    },
    {
      id: 4, // an old ad-hoc workout with no status field
      date: "2026-09-01",
      notes: null,
      exercises: [{ id: 5, workout_id: 4, name: "Squat", order: 0, sets: [] }],
    },
  ],
};

test("workout ids become unique uuids and every reference follows", () => {
  const state = migrateWorkouts(legacyWorkouts as never);
  const [first, second] = state.items;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  for (const id of [first.id, first.exercises[0].id, first.exercises[0].sets[0].id, second.id]) {
    assert.match(id, uuid);
  }
  assert.equal(first.exercises[0].workout_id, first.id);
  assert.equal(first.exercises[0].sets[0].exercise_id, first.exercises[0].id);
  assert.equal(new Set([first.id, second.id, first.exercises[0].id, first.exercises[0].sets[0].id]).size, 4);
});

test("edit times come from when the workout actually happened, and old workouts count as done", () => {
  const state = migrateWorkouts(legacyWorkouts as never);
  assert.equal(state.items[0].updated_at, Date.parse("2026-09-20T10:45:00.000Z"));
  assert.equal(state.items[1].status, "done");
  assert.ok(state.items[1].updated_at > 0);
});

test("migrated data is not queued for upload (it is guest data until the user signs in)", () => {
  const state = migrateWorkouts(legacyWorkouts as never);
  assert.deepEqual(state.dirty, {});
  assert.deepEqual(state.tombstones, {});
});

test("untouched starter presets keep their shared ids; custom presets get new ones", () => {
  const s = STARTER_PRESETS[0];
  const state = migratePresets({
    presets: [
      { id: 1, name: s.name, exercises: s.exercises },
      { id: 4, name: "Arm Day", exercises: [{ name: "Curl", sets: 3, reps: 10, weight: 30 }] },
      { id: 2, name: "Pull Day", exercises: [{ name: "Edited", sets: 1, reps: 1, weight: 5 }] },
    ],
  });
  assert.equal(state.items[0].id, s.id);
  assert.equal(state.items[0].updated_at, 0);
  assert.notEqual(state.items[1].id, s.id);
  assert.ok(state.items[1].updated_at > 0);
  assert.notEqual(state.items[2].id, STARTER_PRESETS[1].id); // an edited "Pull Day" is not a starter anymore
});
