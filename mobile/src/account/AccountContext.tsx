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
import { AppState, Platform } from "react-native";

import { api, ApiError } from "../api/client";
import { loadJson, saveJson } from "../storage/storage";
import { chunk } from "../sync/collection";
import { fromApiPreset, fromApiWorkout, toApiPreset, toApiWorkout } from "../sync/convert";
import type { CollectionPort, SettingsPort } from "../sync/ports";
import type { Preset, Workout } from "../types";
import { tokenStorage } from "./tokenStorage";

// Sign-in is optional. Signed out, the app is purely local. Signed in, the same local data is
// synced with the API in the background; the app never waits on the network to work.

export type SyncState = "idle" | "syncing" | "offline" | "error" | "expired";

interface AccountMeta {
  // Which account the data on this device belongs to (null: nobody, i.e. guest data).
  userId: number | null;
  username: string | null;
  // Server cursor of the last completed pull; null forces a full pull.
  cursor: string | null;
  lastSyncedAt: number | null;
}

const META_KEY = "gymlock_account_v1";
const EMPTY_META: AccountMeta = { userId: null, username: null, cursor: null, lastSyncedAt: null };

interface PortMap {
  workouts: CollectionPort<Workout>;
  presets: CollectionPort<Preset>;
  settings: SettingsPort;
}

interface AccountContextValue {
  isReady: boolean;
  signedIn: boolean;
  username: string | null;
  syncState: SyncState;
  syncError: string | null;
  lastSyncedAt: number | null;
  // Local changes not yet accepted by the server.
  pendingCount: number;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
  // Used by the data stores.
  registerPort: <K extends keyof PortMap>(name: K, port: PortMap[K]) => () => void;
  notifyChange: () => void;
}

const AccountContext = createContext<AccountContextValue | null>(null);

const DEBOUNCE_MS = 1500;
const RETRY_DELAYS_MS = [5_000, 15_000, 45_000, 120_000];
const WORKOUTS_PER_REQUEST = 100;
const PRESETS_PER_REQUEST = 50;
const DELETES_PER_REQUEST = 500;

export function AccountProvider({ children }: PropsWithChildren) {
  const [isReady, setIsReady] = useState(false);
  const [meta, setMetaState] = useState<AccountMeta>(EMPTY_META);
  const [signedIn, setSignedIn] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const metaRef = useRef<AccountMeta>(EMPTY_META);
  const tokenRef = useRef<string | null>(null);
  const portsRef = useRef<Partial<PortMap>>({});
  const runningRef = useRef<Promise<void> | null>(null);
  const rerunRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryIndexRef = useRef(0);
  const runSyncRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const setMeta = useCallback((next: AccountMeta) => {
    metaRef.current = next;
    setMetaState(next);
    saveJson(META_KEY, next);
  }, []);

  const portsReady = () => Boolean(portsRef.current.workouts && portsRef.current.presets && portsRef.current.settings);

  const refreshPending = useCallback(() => {
    const { workouts, presets, settings } = portsRef.current;
    let count = 0;
    if (workouts) {
      const c = workouts.getPending();
      count += c.upserts.length + c.deletes.length;
    }
    if (presets) {
      const c = presets.getPending();
      count += c.upserts.length + c.deletes.length;
    }
    if (settings?.getPending()) count += 1;
    setPendingCount(count);
  }, []);

  const clearTimers = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (retryRef.current) clearTimeout(retryRef.current);
    debounceRef.current = null;
    retryRef.current = null;
  };

  // One request-sized round of push-then-pull. Repeats if there is more than one batch to send.
  const syncOnce = async () => {
    const { workouts, presets, settings } = portsRef.current as PortMap;
    const token = tokenRef.current!;
    const pendingWorkouts = workouts.getPending();
    const pendingPresets = presets.getPending();
    const pendingSettings = settings.getPending();

    const workoutBatches = chunk(pendingWorkouts.upserts, WORKOUTS_PER_REQUEST);
    const presetBatches = chunk(pendingPresets.upserts, PRESETS_PER_REQUEST);
    const rounds = Math.max(1, workoutBatches.length, presetBatches.length);

    for (let round = 0; round < rounds; round++) {
      const sentWorkouts = workoutBatches[round] ?? [];
      const sentPresets = presetBatches[round] ?? [];
      const sentWorkoutDeletes = round === 0 ? pendingWorkouts.deletes.slice(0, DELETES_PER_REQUEST) : [];
      const sentPresetDeletes = round === 0 ? pendingPresets.deletes.slice(0, DELETES_PER_REQUEST) : [];

      const response = await api.sync(tokenRef.current ?? token, {
        cursor: metaRef.current.cursor,
        workouts: sentWorkouts.map(toApiWorkout),
        presets: sentPresets.map(toApiPreset),
        deleted_workouts: sentWorkoutDeletes,
        deleted_presets: sentPresetDeletes,
        ...(round === 0 && pendingSettings
          ? { settings: { rest_timer_seconds: pendingSettings.rest_timer_seconds, updated_at: pendingSettings.updated_at } }
          : {}),
      });

      // Merge the server's changes first, then mark what we sent as delivered.
      workouts.applyRemote({ upserts: response.workouts.map(fromApiWorkout), deletes: response.deleted_workouts });
      presets.applyRemote({ upserts: response.presets.map(fromApiPreset), deletes: response.deleted_presets });
      settings.applyRemote(response.settings);
      workouts.acknowledge({
        upserts: sentWorkouts.map((w) => ({ id: w.id, updated_at: w.updated_at })),
        deletes: sentWorkoutDeletes,
      });
      presets.acknowledge({
        upserts: sentPresets.map((p) => ({ id: p.id, updated_at: p.updated_at })),
        deletes: sentPresetDeletes,
      });
      if (round === 0 && pendingSettings) settings.acknowledge(pendingSettings.updated_at);

      setMeta({ ...metaRef.current, cursor: response.cursor });
      if (response.token) {
        tokenRef.current = response.token;
        await tokenStorage.set(response.token);
      }
    }
  };

  const expireSession = useCallback(async () => {
    tokenRef.current = null;
    await tokenStorage.clear();
    clearTimers();
    setSignedIn(false);
    setSyncState("expired");
    setSyncError("Your session expired. Sign in again to keep syncing.");
  }, []);

  const runSync = useCallback((): Promise<void> => {
    if (!tokenRef.current || !portsReady()) return Promise.resolve();
    if (runningRef.current) {
      rerunRef.current = true;
      return runningRef.current;
    }
    const run = (async () => {
      setSyncState("syncing");
      setSyncError(null);
      try {
        do {
          rerunRef.current = false;
          await syncOnce();
        } while (rerunRef.current && tokenRef.current);
        retryIndexRef.current = 0;
        setMeta({ ...metaRef.current, lastSyncedAt: Date.now() });
        setSyncState("idle");
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await expireSession();
        } else {
          setSyncState(error instanceof ApiError && error.network ? "offline" : "error");
          setSyncError(error instanceof Error ? error.message : "Sync failed");
          const delay = RETRY_DELAYS_MS[Math.min(retryIndexRef.current++, RETRY_DELAYS_MS.length - 1)];
          if (retryRef.current) clearTimeout(retryRef.current);
          retryRef.current = setTimeout(() => void runSyncRef.current(), delay);
        }
      } finally {
        runningRef.current = null;
        refreshPending();
      }
    })();
    runningRef.current = run;
    return run;
    // syncOnce reads everything through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expireSession, refreshPending, setMeta]);
  runSyncRef.current = runSync;

  const notifyChange = useCallback(() => {
    refreshPending();
    if (!tokenRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void runSyncRef.current(), DEBOUNCE_MS);
  }, [refreshPending]);

  const registerPort = useCallback(
    <K extends keyof PortMap>(name: K, port: PortMap[K]) => {
      portsRef.current[name] = port;
      refreshPending();
      if (tokenRef.current && portsReady()) void runSyncRef.current();
      return () => {
        if (portsRef.current[name] === port) delete portsRef.current[name];
      };
    },
    [refreshPending]
  );

  // Restore the session (if any) when the app starts.
  useEffect(() => {
    Promise.all([tokenStorage.get(), loadJson<AccountMeta>(META_KEY)]).then(([token, stored]) => {
      const restored = stored ?? EMPTY_META;
      metaRef.current = restored;
      setMetaState(restored);
      tokenRef.current = token;
      setSignedIn(Boolean(token));
      if (!token && restored.userId !== null) {
        setSyncState("expired");
        setSyncError("Your session expired. Sign in again to keep syncing.");
      }
      setIsReady(true);
      if (token) void runSyncRef.current();
    });
  }, []);

  // Sync again when the app comes back to the foreground or the connection returns.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void runSyncRef.current();
    });
    const onOnline = () => void runSyncRef.current();
    if (Platform.OS === "web") window.addEventListener("online", onOnline);
    return () => {
      subscription.remove();
      if (Platform.OS === "web") window.removeEventListener("online", onOnline);
    };
  }, []);

  const finishSignIn = useCallback(
    async (accessToken: string) => {
      const me = await api.me(accessToken);
      const previous = metaRef.current;
      const ports = portsRef.current;
      let cursor = previous.cursor;

      if (previous.userId !== null && previous.userId !== me.id) {
        // This device still holds another account's data: never mix it into this one.
        ports.workouts?.reset();
        ports.presets?.reset();
        ports.settings?.reset();
        cursor = null;
      } else if (previous.userId === null) {
        // Guest data becomes part of the account the first time someone signs in.
        ports.workouts?.markAllDirty();
        ports.presets?.markAllDirty();
        ports.settings?.markDirty();
        cursor = null;
      }

      await tokenStorage.set(accessToken);
      tokenRef.current = accessToken;
      setMeta({ userId: me.id, username: me.username, cursor, lastSyncedAt: previous.lastSyncedAt });
      setSignedIn(true);
      setSyncState("idle");
      setSyncError(null);
      refreshPending();
      void runSyncRef.current();
    },
    [refreshPending, setMeta]
  );

  const signIn = useCallback(
    async (username: string, password: string) => {
      const { access_token } = await api.login(username.trim(), password);
      await finishSignIn(access_token);
    },
    [finishSignIn]
  );

  const signUp = useCallback(
    async (username: string, password: string) => {
      const { access_token } = await api.signup(username.trim(), password);
      await finishSignIn(access_token);
    },
    [finishSignIn]
  );

  const signOut = useCallback(async () => {
    // Best effort: push what is still pending so nothing on this device is lost.
    if (tokenRef.current) await runSyncRef.current().catch(() => undefined);
    clearTimers();
    await tokenStorage.clear();
    tokenRef.current = null;
    portsRef.current.workouts?.reset();
    portsRef.current.presets?.reset();
    portsRef.current.settings?.reset();
    setMeta(EMPTY_META);
    setSignedIn(false);
    setSyncState("idle");
    setSyncError(null);
    setPendingCount(0);
  }, [setMeta]);

  const syncNow = useCallback(() => runSyncRef.current(), []);

  const value = useMemo<AccountContextValue>(
    () => ({
      isReady,
      signedIn,
      username: meta.username,
      syncState,
      syncError,
      lastSyncedAt: meta.lastSyncedAt,
      pendingCount,
      signIn,
      signUp,
      signOut,
      syncNow,
      registerPort,
      notifyChange,
    }),
    [isReady, signedIn, meta, syncState, syncError, pendingCount, signIn, signUp, signOut, syncNow, registerPort, notifyChange]
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccount must be used within an AccountProvider");
  return ctx;
}
