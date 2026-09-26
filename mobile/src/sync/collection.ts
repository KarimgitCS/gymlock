// Pure bookkeeping for one synced collection (workouts or presets). No React, no storage, no
// network, so the conflict rules can be tested on their own.
//
// Every item carries `updated_at` (epoch ms of the last local edit). For each id the newest edit
// wins, whether it is an upsert or a delete. `dirty` and `tombstones` remember what still has to
// be sent to the server.

export interface Stamped {
  id: string;
  updated_at: number;
}

export interface Tombstone {
  id: string;
  updated_at: number;
}

export interface CollectionState<T extends Stamped> {
  items: T[];
  // id -> the updated_at value that has not been pushed yet
  dirty: Record<string, number>;
  // id -> when it was deleted locally and not yet pushed
  tombstones: Record<string, number>;
}

export interface Changes<T> {
  upserts: T[];
  deletes: Tombstone[];
}

export function emptyState<T extends Stamped>(): CollectionState<T> {
  return { items: [], dirty: {}, tombstones: {} };
}

// Strictly increasing per item even if the clock stalls or two edits land in the same millisecond.
export function nextStamp(previous: number | undefined, now: number = Date.now()): number {
  return Math.max(now, (previous ?? 0) + 1);
}

export function upsertLocal<T extends Stamped>(state: CollectionState<T>, item: T): CollectionState<T> {
  const exists = state.items.some((i) => i.id === item.id);
  const { [item.id]: _removed, ...tombstones } = state.tombstones;
  return {
    items: exists ? state.items.map((i) => (i.id === item.id ? item : i)) : [item, ...state.items],
    dirty: { ...state.dirty, [item.id]: item.updated_at },
    tombstones,
  };
}

export function deleteLocal<T extends Stamped>(
  state: CollectionState<T>,
  id: string,
  at: number = Date.now()
): CollectionState<T> {
  const existing = state.items.find((i) => i.id === id);
  if (!existing) return state;
  const { [id]: _removed, ...dirty } = state.dirty;
  return {
    items: state.items.filter((i) => i.id !== id),
    dirty,
    tombstones: { ...state.tombstones, [id]: nextStamp(existing.updated_at, at) },
  };
}

export function pendingChanges<T extends Stamped>(state: CollectionState<T>): Changes<T> {
  return {
    upserts: state.items.filter((i) => i.id in state.dirty),
    deletes: Object.entries(state.tombstones).map(([id, updated_at]) => ({ id, updated_at })),
  };
}

// After a successful push, forget what was sent — unless the item was edited again while the
// request was in flight (its current stamp differs), in which case it is still pending.
export function acknowledge<T extends Stamped>(
  state: CollectionState<T>,
  pushed: { upserts: Stamped[]; deletes: Tombstone[] }
): CollectionState<T> {
  const dirty = { ...state.dirty };
  for (const p of pushed.upserts) if (dirty[p.id] === p.updated_at) delete dirty[p.id];
  const tombstones = { ...state.tombstones };
  for (const d of pushed.deletes) if (tombstones[d.id] === d.updated_at) delete tombstones[d.id];
  return { ...state, dirty, tombstones };
}

// Merge what the server sent. Newer edit wins; on a tie the local copy stays.
export function applyRemote<T extends Stamped>(
  state: CollectionState<T>,
  remote: Changes<T>
): CollectionState<T> {
  let items = state.items;
  const dirty = { ...state.dirty };
  const tombstones = { ...state.tombstones };

  for (const incoming of remote.upserts) {
    const local = items.find((i) => i.id === incoming.id);
    const localDeletedAt = tombstones[incoming.id];

    if (localDeletedAt !== undefined) {
      // Deleted here. Only a newer edit elsewhere brings it back.
      if (incoming.updated_at > localDeletedAt) {
        delete tombstones[incoming.id];
        items = [incoming, ...items];
      }
      continue;
    }
    if (!local) {
      items = [incoming, ...items];
    } else if (incoming.updated_at > local.updated_at) {
      items = items.map((i) => (i.id === incoming.id ? incoming : i));
      delete dirty[incoming.id];
    }
    // else: the local copy is newer or equal, so it stays (and is pushed if still dirty).
  }

  for (const gone of remote.deletes) {
    const local = items.find((i) => i.id === gone.id);
    if (local && local.updated_at <= gone.updated_at) {
      items = items.filter((i) => i.id !== gone.id);
      delete dirty[gone.id];
    }
    // A local copy edited after the delete survives and will be pushed as a resurrection.
    if (tombstones[gone.id] !== undefined && tombstones[gone.id] <= gone.updated_at) {
      delete tombstones[gone.id];
    }
  }

  return { items, dirty, tombstones };
}

// First sign-in: everything on this device should go up to the account.
export function markAllDirty<T extends Stamped>(state: CollectionState<T>): CollectionState<T> {
  const dirty: Record<string, number> = {};
  for (const item of state.items) dirty[item.id] = item.updated_at;
  return { ...state, dirty };
}

export function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
