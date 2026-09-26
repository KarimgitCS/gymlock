import { useCallback, useEffect, useRef, useState } from "react";

import { useAccount } from "../account/AccountContext";
import { saveJson } from "../storage/storage";
import type { CollectionPort } from "./ports";
import {
  acknowledge,
  applyRemote,
  markAllDirty,
  pendingChanges,
  type CollectionState,
  type Stamped,
} from "./collection";

// Shared plumbing for a synced collection: load from the device, keep a ref that is always the
// latest state (so back-to-back actions never read stale data), persist on every change, and
// register with the sync engine.
export function useSyncedCollection<T extends Stamped>(options: {
  name: "workouts" | "presets";
  storageKey: string;
  load: () => Promise<CollectionState<T>>;
  fresh: () => CollectionState<T>;
}) {
  const account = useAccount();
  const { name, storageKey, load, fresh } = options;
  const [state, setState] = useState<CollectionState<T>>(fresh);
  const [isLoading, setIsLoading] = useState(true);
  const ref = useRef<CollectionState<T>>(state);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const notifyRef = useRef(account.notifyChange);
  notifyRef.current = account.notifyChange;

  const update = useCallback(
    (next: CollectionState<T>, notify = true) => {
      ref.current = next;
      setState(next);
      saveJson(storageKey, next);
      if (notify) notifyRef.current();
    },
    [storageKey]
  );

  useEffect(() => {
    let cancelled = false;
    load().then((loaded) => {
      if (cancelled) return;
      ref.current = loaded;
      setState(loaded);
      saveJson(storageKey, loaded);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // Load once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { registerPort } = account;
  useEffect(() => {
    if (isLoading) return;
    const port: CollectionPort<T> = {
      getPending: () => pendingChanges(ref.current),
      acknowledge: (pushed) => update(acknowledge(ref.current, pushed), false),
      applyRemote: (remote) => update(applyRemote(ref.current, remote), false),
      markAllDirty: () => update(markAllDirty(ref.current), false),
      reset: () => update(optionsRef.current.fresh(), false),
    };
    // The engine keys ports by name and knows each name's concrete item type.
    return registerPort(name, port as never);
  }, [isLoading, name, registerPort, update]);

  return { state, items: state.items, isLoading, ref, update };
}
