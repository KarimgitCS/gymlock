import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

/**
 * Counts down from `durationSeconds`, anchored to a wall-clock end timestamp
 * rather than a plain decrementing counter. JS timers are throttled or paused
 * while the app is backgrounded, so a naive `setInterval` countdown would lose
 * time; recomputing from `Date.now()` on every tick and on every AppState
 * transition back to "active" keeps the remaining time accurate regardless of
 * how long the app was backgrounded.
 */
export function useRestTimer(durationSeconds: number) {
  const endsAtRef = useRef(Date.now() + durationSeconds * 1000);
  const [remaining, setRemaining] = useState(durationSeconds);

  useEffect(() => {
    const tick = () => {
      const secondsLeft = Math.max(0, Math.ceil((endsAtRef.current - Date.now()) / 1000));
      setRemaining(secondsLeft);
    };

    tick();
    const interval = setInterval(tick, 1000);
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") tick();
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);

  const addSeconds = (delta: number) => {
    endsAtRef.current += delta * 1000;
    setRemaining(Math.max(0, Math.ceil((endsAtRef.current - Date.now()) / 1000)));
  };

  return { remaining, isDone: remaining <= 0, addSeconds };
}
