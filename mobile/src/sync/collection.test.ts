import assert from "node:assert/strict";
import { test } from "node:test";

import {
  acknowledge,
  applyRemote,
  chunk,
  deleteLocal,
  emptyState,
  markAllDirty,
  nextStamp,
  pendingChanges,
  upsertLocal,
  type CollectionState,
} from "./collection";

interface Item {
  id: string;
  updated_at: number;
  name: string;
}
const item = (id: string, updated_at: number, name = id): Item => ({ id, updated_at, name });
const seeded = (...items: Item[]): CollectionState<Item> => ({
  items,
  dirty: {},
  tombstones: {},
});

test("nextStamp always moves forward, even if the clock does not", () => {
  assert.equal(nextStamp(undefined, 1000), 1000);
  assert.equal(nextStamp(5000, 1000), 5001);
  assert.equal(nextStamp(1000, 1000), 1001);
});

test("a local edit is tracked as pending until it is acknowledged", () => {
  let s = upsertLocal(emptyState<Item>(), item("a", 10));
  assert.deepEqual(pendingChanges(s).upserts.map((i) => i.id), ["a"]);
  s = acknowledge(s, { upserts: [{ id: "a", updated_at: 10 }], deletes: [] });
  assert.equal(pendingChanges(s).upserts.length, 0);
});

test("an item edited again during an in-flight push stays pending", () => {
  let s = upsertLocal(emptyState<Item>(), item("a", 10));
  s = upsertLocal(s, item("a", 20)); // edited while the request carrying stamp 10 was out
  s = acknowledge(s, { upserts: [{ id: "a", updated_at: 10 }], deletes: [] });
  assert.deepEqual(pendingChanges(s).upserts.map((i) => i.updated_at), [20]);
});

test("deleting records a tombstone stamped after the item's last edit", () => {
  let s = upsertLocal(emptyState<Item>(), item("a", 5000));
  s = deleteLocal(s, "a", 1000);
  assert.equal(s.items.length, 0);
  assert.deepEqual(pendingChanges(s).deletes, [{ id: "a", updated_at: 5001 }]);
  assert.deepEqual(s.dirty, {});
});

test("deleting something that does not exist changes nothing", () => {
  const s = emptyState<Item>();
  assert.equal(deleteLocal(s, "nope"), s);
});

test("re-creating a deleted id clears its tombstone", () => {
  let s = upsertLocal(emptyState<Item>(), item("a", 10));
  s = deleteLocal(s, "a", 20);
  s = upsertLocal(s, item("a", 30));
  assert.deepEqual(s.tombstones, {});
  assert.equal(s.items.length, 1);
});

test("remote items that are new to this device are added", () => {
  const s = applyRemote(seeded(item("a", 10)), { upserts: [item("b", 5)], deletes: [] });
  assert.deepEqual(s.items.map((i) => i.id).sort(), ["a", "b"]);
});

test("a newer remote edit replaces the local one and clears its pending flag", () => {
  let s = upsertLocal(emptyState<Item>(), item("a", 10, "old"));
  s = applyRemote(s, { upserts: [item("a", 20, "new")], deletes: [] });
  assert.equal(s.items[0].name, "new");
  assert.deepEqual(s.dirty, {});
});

test("an older remote edit never overwrites a newer local one", () => {
  let s = upsertLocal(emptyState<Item>(), item("a", 50, "mine"));
  s = applyRemote(s, { upserts: [item("a", 20, "theirs")], deletes: [] });
  assert.equal(s.items[0].name, "mine");
  assert.deepEqual(Object.keys(s.dirty), ["a"]); // still queued for upload
});

test("on a tie the local copy is kept", () => {
  const s = applyRemote(seeded(item("a", 10, "mine")), { upserts: [item("a", 10, "theirs")], deletes: [] });
  assert.equal(s.items[0].name, "mine");
});

test("a remote delete removes an item that was not edited since", () => {
  const s = applyRemote(seeded(item("a", 10)), { upserts: [], deletes: [{ id: "a", updated_at: 20 }] });
  assert.equal(s.items.length, 0);
});

test("a local edit made after the remote delete survives and is re-uploaded", () => {
  let s = upsertLocal(emptyState<Item>(), item("a", 50, "edited after"));
  s = applyRemote(s, { upserts: [], deletes: [{ id: "a", updated_at: 20 }] });
  assert.equal(s.items.length, 1);
  assert.deepEqual(Object.keys(s.dirty), ["a"]);
});

test("a remote copy older than a local delete does not resurrect the item", () => {
  let s = upsertLocal(emptyState<Item>(), item("a", 10));
  s = deleteLocal(s, "a", 100);
  s = applyRemote(s, { upserts: [item("a", 50)], deletes: [] });
  assert.equal(s.items.length, 0);
  assert.equal(pendingChanges(s).deletes.length, 1);
});

test("a remote edit newer than a local delete brings the item back", () => {
  let s = upsertLocal(emptyState<Item>(), item("a", 10));
  s = deleteLocal(s, "a", 100);
  s = applyRemote(s, { upserts: [item("a", 500)], deletes: [] });
  assert.equal(s.items.length, 1);
  assert.deepEqual(s.tombstones, {});
});

test("applying the same remote changes twice gives the same result", () => {
  const remote = { upserts: [item("b", 5), item("a", 30, "x")], deletes: [{ id: "c", updated_at: 9 }] };
  const once = applyRemote(seeded(item("a", 10), item("c", 1)), remote);
  const twice = applyRemote(once, remote);
  assert.deepEqual(twice, once);
});

test("two devices that exchange changes end up with the same items", () => {
  let a = emptyState<Item>();
  let b = emptyState<Item>();
  a = upsertLocal(a, item("x", 10, "from A"));
  b = upsertLocal(b, item("y", 11, "from B"));
  b = upsertLocal(b, item("x", 20, "B edited x"));
  const toB = pendingChanges(a);
  const toA = pendingChanges(b);
  b = applyRemote(b, toB);
  a = applyRemote(a, toA);
  const view = (s: CollectionState<Item>) => s.items.map((i) => `${i.id}:${i.name}`).sort();
  assert.deepEqual(view(a), view(b));
  assert.deepEqual(view(a), ["x:B edited x", "y:from B"]);
});

test("markAllDirty queues every item, for the first sign-in", () => {
  const s = markAllDirty(seeded(item("a", 1), item("b", 2)));
  assert.deepEqual(s.dirty, { a: 1, b: 2 });
});

test("chunk splits a list into batches", () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 3), []);
});
