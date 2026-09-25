import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import { loadJson, saveJson } from "../storage/storage";

const SETTINGS_KEY = "gymlock_settings_v1";
export const DEFAULT_REST_SECONDS = 90;

interface StoredSettings {
  restTimerSeconds: number;
}

interface SettingsContextValue {
  restTimerSeconds: number;
  setRestTimerSeconds: (seconds: number) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: PropsWithChildren) {
  const [restTimerSeconds, setSeconds] = useState(DEFAULT_REST_SECONDS);

  useEffect(() => {
    loadJson<StoredSettings>(SETTINGS_KEY).then((stored) => {
      if (stored && Number.isFinite(stored.restTimerSeconds)) {
        setSeconds(stored.restTimerSeconds);
      }
    });
  }, []);

  const setRestTimerSeconds = useCallback(async (seconds: number) => {
    setSeconds(seconds);
    await saveJson(SETTINGS_KEY, { restTimerSeconds: seconds } satisfies StoredSettings);
  }, []);

  const value = useMemo(
    () => ({ restTimerSeconds, setRestTimerSeconds }),
    [restTimerSeconds, setRestTimerSeconds]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within a SettingsProvider");
  return ctx;
}
