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

import { useAccount } from "../account/AccountContext";
import { loadJson, saveJson } from "../storage/storage";
import { nextStamp } from "../sync/collection";

const SETTINGS_KEY = "gymlock_settings_v2";
const LEGACY_SETTINGS_KEY = "gymlock_settings_v1";
export const DEFAULT_REST_SECONDS = 90;

interface StoredSettings {
  restTimerSeconds: number;
  // Local edit time (epoch ms); 0 means "never changed", so any synced value replaces it.
  updatedAt: number;
  dirty: boolean;
}

const DEFAULTS: StoredSettings = { restTimerSeconds: DEFAULT_REST_SECONDS, updatedAt: 0, dirty: false };

interface SettingsContextValue {
  restTimerSeconds: number;
  setRestTimerSeconds: (seconds: number) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

async function loadSettings(): Promise<StoredSettings> {
  const stored = await loadJson<StoredSettings>(SETTINGS_KEY);
  if (stored) return stored;
  const legacy = await loadJson<{ restTimerSeconds: number }>(LEGACY_SETTINGS_KEY);
  return legacy && Number.isFinite(legacy.restTimerSeconds)
    ? { restTimerSeconds: legacy.restTimerSeconds, updatedAt: Date.now(), dirty: false }
    : DEFAULTS;
}

export function SettingsProvider({ children }: PropsWithChildren) {
  const account = useAccount();
  const [settings, setSettings] = useState<StoredSettings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef(settings);
  const notifyRef = useRef(account.notifyChange);
  notifyRef.current = account.notifyChange;

  const commit = useCallback((next: StoredSettings, notify: boolean) => {
    ref.current = next;
    setSettings(next);
    saveJson(SETTINGS_KEY, next);
    if (notify) notifyRef.current();
  }, []);

  useEffect(() => {
    loadSettings().then((s) => {
      ref.current = s;
      setSettings(s);
      setLoaded(true);
    });
  }, []);

  const { registerPort } = account;
  useEffect(() => {
    if (!loaded) return;
    return registerPort("settings", {
      getPending: () =>
        ref.current.dirty
          ? { rest_timer_seconds: ref.current.restTimerSeconds, updated_at: ref.current.updatedAt }
          : null,
      acknowledge: (updatedAt) => {
        if (ref.current.dirty && ref.current.updatedAt === updatedAt) commit({ ...ref.current, dirty: false }, false);
      },
      applyRemote: (remote) => {
        if (remote && remote.updated_at > ref.current.updatedAt) {
          commit({ restTimerSeconds: remote.rest_timer_seconds, updatedAt: remote.updated_at, dirty: false }, false);
        }
      },
      markDirty: () => {
        if (ref.current.updatedAt > 0) commit({ ...ref.current, dirty: true }, false);
      },
      reset: () => commit(DEFAULTS, false),
    });
  }, [loaded, registerPort, commit]);

  const setRestTimerSeconds = useCallback(
    async (seconds: number) => {
      commit({ restTimerSeconds: seconds, updatedAt: nextStamp(ref.current.updatedAt), dirty: true }, true);
    },
    [commit]
  );

  const value = useMemo(
    () => ({ restTimerSeconds: settings.restTimerSeconds, setRestTimerSeconds }),
    [settings.restTimerSeconds, setRestTimerSeconds]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within a SettingsProvider");
  return ctx;
}
