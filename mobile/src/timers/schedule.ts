// A rest ending is announced by a short burst of repeating notifications, because a phone locked
// on the lock screen cannot run a continuous alarm: the first fires when the rest ends, then a
// reminder every few seconds until the user comes back to the app.
export const REPEAT_EVERY_SECONDS = 8;
export const REPEAT_COUNT = 8; // about a minute of reminders

// Seconds from now at which each notification should fire.
export function alertOffsets(
  firstInSeconds: number,
  every: number = REPEAT_EVERY_SECONDS,
  count: number = REPEAT_COUNT
): number[] {
  const first = Math.max(1, Math.round(firstInSeconds));
  return Array.from({ length: count }, (_, i) => first + i * every);
}

// True once the rest has ended, which is when coming back to the app should silence the reminders.
export function restIsOver(endsAt: number | null | undefined, now: number = Date.now()): boolean {
  return typeof endsAt === "number" && now >= endsAt;
}

export const ALARM_MAX_MS = 60_000;
