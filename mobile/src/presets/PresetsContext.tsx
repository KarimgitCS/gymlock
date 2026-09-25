import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

import { loadJson, saveJson } from "../storage/storage";
import type { Preset, PresetExercise } from "../types";

const PRESETS_KEY = "gymlock_presets_v1";

interface StoredPresets {
  nextId: number;
  presets: Preset[];
}

export interface PresetDraft {
  id?: number;
  name: string;
  exercises: PresetExercise[];
}

interface PresetsContextValue {
  presets: Preset[];
  isLoading: boolean;
  getPreset: (id: number) => Preset | undefined;
  savePreset: (draft: PresetDraft) => Promise<Preset>;
  deletePreset: (id: number) => Promise<void>;
}

// Starter sessions so the first launch isn't empty; they can be edited or deleted like any other.
const STARTERS: Omit<Preset, "id">[] = [
  {
    name: "Push Day",
    exercises: [
      { name: "Bench Press", sets: 4, reps: 8, weight: 135 },
      { name: "Overhead Press", sets: 3, reps: 10, weight: 75 },
      { name: "Incline Dumbbell Press", sets: 3, reps: 10, weight: 50 },
      { name: "Tricep Pushdown", sets: 3, reps: 12, weight: 40 },
    ],
  },
  {
    name: "Pull Day",
    exercises: [
      { name: "Deadlift", sets: 3, reps: 5, weight: 185 },
      { name: "Barbell Row", sets: 4, reps: 8, weight: 115 },
      { name: "Lat Pulldown", sets: 3, reps: 10, weight: 100 },
      { name: "Bicep Curl", sets: 3, reps: 12, weight: 30 },
    ],
  },
  {
    name: "Leg Day",
    exercises: [
      { name: "Squat", sets: 4, reps: 8, weight: 155 },
      { name: "Romanian Deadlift", sets: 3, reps: 10, weight: 115 },
      { name: "Leg Press", sets: 3, reps: 12, weight: 200 },
      { name: "Calf Raise", sets: 4, reps: 15, weight: 100 },
    ],
  },
];

const PresetsContext = createContext<PresetsContextValue | null>(null);

export function PresetsProvider({ children }: PropsWithChildren) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const presetsRef = useRef<Preset[]>([]);
  const nextIdRef = useRef(1);

  const persist = useCallback((next: Preset[]) => {
    presetsRef.current = next;
    setPresets(next);
    saveJson(PRESETS_KEY, { nextId: nextIdRef.current, presets: next } satisfies StoredPresets);
  }, []);

  useEffect(() => {
    loadJson<StoredPresets>(PRESETS_KEY).then((stored) => {
      if (stored) {
        nextIdRef.current = stored.nextId;
        presetsRef.current = stored.presets;
        setPresets(stored.presets);
      } else {
        const seeded = STARTERS.map((p) => ({ ...p, id: nextIdRef.current++ }));
        persist(seeded);
      }
      setIsLoading(false);
    });
  }, [persist]);

  const getPreset = useCallback((id: number) => presets.find((p) => p.id === id), [presets]);

  const savePreset = useCallback(
    async (draft: PresetDraft) => {
      const existing = draft.id !== undefined;
      const preset: Preset = {
        id: draft.id ?? nextIdRef.current++,
        name: draft.name.trim(),
        exercises: draft.exercises.map((e) => ({ ...e, name: e.name.trim() })),
      };
      persist(
        existing
          ? presetsRef.current.map((p) => (p.id === preset.id ? preset : p))
          : [...presetsRef.current, preset]
      );
      return preset;
    },
    [persist]
  );

  const deletePreset = useCallback(
    async (id: number) => {
      persist(presetsRef.current.filter((p) => p.id !== id));
    },
    [persist]
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
