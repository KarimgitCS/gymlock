import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

/**
 * Counts down to an absolute timestamp rather than decrementing a counter, so the value is always
 * derived from the wall clock. JS timers are throttled while the app is backgrounded; recomputing
 * from Date.now() on every tick and whenever the app returns to the foreground keeps it exact.
 * `onFinish` fires once, only if the countdown reaches zero while mounted (not for a rest that
 * had already ended before this screen loaded).
 */
export function useRestTimer(endsAt: number | null, onFinish?: () => void) {
  const compute = () => (endsAt === null ? 0 : Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
  const [remaining, setRemaining] = useState(compute);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;
  const firedForRef = useRef<number | null>(null);

  useEffect(() => {
    if (endsAt === null) {
      setRemaining(0);
      return;
    }
    const startedWithTimeLeft = endsAt - Date.now() > 0;
    if (!startedWithTimeLeft) firedForRef.current = endsAt;

    const tick = () => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0 && firedForRef.current !== endsAt) {
        firedForRef.current = endsAt;
        finishRef.current?.();
      }
    };

    tick();
    const interval = setInterval(tick, 250);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") tick();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [endsAt]);

  return { remaining, isRunning: endsAt !== null && remaining > 0 };
}
