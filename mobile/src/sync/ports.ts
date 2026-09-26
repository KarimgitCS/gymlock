import type { Changes, Stamped, Tombstone } from "./collection";

// What a data store exposes so the sync engine can read its pending changes and merge in the
// server's, without knowing anything about workouts or presets.
export interface CollectionPort<T extends Stamped> {
  getPending(): Changes<T>;
  acknowledge(pushed: { upserts: Stamped[]; deletes: Tombstone[] }): void;
  applyRemote(remote: Changes<T>): void;
  markAllDirty(): void;
  reset(): void;
}

export interface SettingsRemote {
  rest_timer_seconds: number;
  updated_at: number;
}

export interface SettingsPort {
  getPending(): SettingsRemote | null;
  acknowledge(updatedAt: number): void;
  applyRemote(remote: SettingsRemote | null): void;
  markDirty(): void;
  reset(): void;
}
