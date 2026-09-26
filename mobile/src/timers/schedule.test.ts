import assert from "node:assert/strict";
import { test } from "node:test";

import { alertOffsets, REPEAT_COUNT, REPEAT_EVERY_SECONDS, restIsOver } from "./schedule";

test("reminders repeat at a fixed spacing after the first alert", () => {
  const offsets = alertOffsets(90);
  assert.equal(offsets.length, REPEAT_COUNT);
  assert.equal(offsets[0], 90);
  assert.equal(offsets[1] - offsets[0], REPEAT_EVERY_SECONDS);
  assert.equal(offsets[REPEAT_COUNT - 1], 90 + (REPEAT_COUNT - 1) * REPEAT_EVERY_SECONDS);
});

test("the first alert is never scheduled in the past or at zero", () => {
  assert.equal(alertOffsets(0)[0], 1);
  assert.equal(alertOffsets(-5)[0], 1);
  assert.equal(alertOffsets(2.6)[0], 3);
});

test("the reminders cover roughly a minute", () => {
  const offsets = alertOffsets(10);
  assert.ok(offsets[offsets.length - 1] - offsets[0] >= 50);
});

test("the rest is only over once its end time has passed", () => {
  assert.equal(restIsOver(1000, 999), false);
  assert.equal(restIsOver(1000, 1000), true);
  assert.equal(restIsOver(1000, 5000), true);
  assert.equal(restIsOver(null, 5000), false);
  assert.equal(restIsOver(undefined, 5000), false);
});
