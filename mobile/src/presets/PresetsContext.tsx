import { createContext, useCallback, useContext, useMemo, type PropsWithChildren } from "react";

import { migratePresets } from "../storage/legacy";
import { loadJson } from "../storage/storage";
import { deleteLocal, nextStamp, upsertLocal, type CollectionState } from "../sync/collection";
import { useSyncedCollection } from "../sync/useSyncedCollection";
import type { Preset, PresetExercise } from "../types";
import { newId } from "../utils/id";
import { STARTER_PRESETS } from "./starters";

const PRESETS_KEY = "gymlock_presets_v2";
const LEGACY_PRESETS_KEY = "gymlock_presets_v1";

export interface PresetDraft {
  id?: string;
  name: string;
  exercises: PresetExercise[];
}

interface PresetsContextValue {
  presets: Preset[];
  isLoading: boolean;
  getPreset: (id: string) => Preset | undefined;
  savePreset: (draft: PresetDraft) => Promise<Preset>;
  deletePreset: (id: string) => Promise<void>;
}

const PresetsContext = createContext<PresetsContextValue | null>(null);

// A device that has never saved anything starts with the starter sessions (not queued for upload).
const freshPresets = (): CollectionState<Preset> => ({
  items: STARTER_PRESETS.map((p) => ({ ...p, exercises: p.exercises.map((e) => ({ ...e })) })),
  dirty: {},
  tombstones: {},
});

async function loadPresets(): Promise<CollectionState<Preset>> {
  const stored = await loadJson<CollectionState<Preset>>(PRESETS_KEY);
  if (stored) return stored;
  const legacy = await loadJson<Parameters<typeof migratePresets>[0]>(LEGACY_PRESETS_KEY);
  return legacy ? migratePresets(legacy) : freshPresets();
}

export function PresetsProvider({ children }: PropsWithChildren) {
  const { items, isLoading, ref, update } = useSyncedCollection<Preset>({
    name: "presets",
    storageKey: PRESETS_KEY,
    load: loadPresets,
    fresh: freshPresets,
  });

  // Alphabetical so every device shows the same order regardless of how data arrived.
  const presets = useMemo(
    () => [...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [items]
  );

  const getPreset = useCallback((id: string) => items.find((p) => p.id === id), [items]);

  const savePreset = useCallback(
    async (draft: PresetDraft) => {
      const existing = draft.id ? ref.current.items.find((p) => p.id === draft.id) : undefined;
      const preset: Preset = {
        id: draft.id ?? newId(),
        name: draft.name.trim(),
        exercises: draft.exercises.map((e) => ({ ...e, name: e.name.trim() })),
        updated_at: nextStamp(existing?.updated_at),
      };
      update(upsertLocal(ref.current, preset));
      return preset;
    },
    [ref, update]
  );

  const deletePreset = useCallback(
    async (id: string) => {
      update(deleteLocal(ref.current, id));
    },
    [ref, update]
  );

  const value = useMemo(
    () => ({ presets, isLoading, getPreset, savePreset, deletePreset }),
    [presets, isLoading, getPreset, savePreset, deletePreset]
  );

  return <PresetsContext.Provider value={value}>{children}</PresetsContext.Provider>;
}

export function usePresets(): PresetsContextValue {
  const ctx = useContext(PresetsContext);
  if (!ctx) throw new Error("usePresets must be used within a PresetsProvider");
  return ctx;
}
