import { Platform, Vibration } from "react-native";
import type * as NotificationsType from "expo-notifications";

import { buildBeepWav } from "./beep";
import { alertOffsets } from "./schedule";

// Phones (Expo): the end of the rest is scheduled as a burst of local notifications with the OS
// (one when the rest ends, then a reminder every few seconds), so it fires even when the app is in
// the background or the phone is locked, and keeps nagging until the user comes back.
//
// Web: a browser page cannot schedule anything once it is backgrounded or the phone is locked,
// so the page instead keeps the screen awake during a workout and plays a sound and vibrates when
// the rest ends while the page is open.

export type AlertPermission = "granted" | "denied" | "unavailable";
export interface AlertResult {
  ok: boolean;
  message: string;
}

const CHANNEL_ID = "rest-timer";
let scheduledIds: string[] = [];
let configured = false;

function notifications(): typeof NotificationsType | null {
  if (Platform.OS === "web") return null;
  // Required lazily: the module is not designed for web.
  return require("expo-notifications") as typeof NotificationsType;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function configure(N: typeof NotificationsType) {
  if (configured) return;
  configured = true;
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  if (Platform.OS === "android") {
    await N.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Rest timer",
      importance: N.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 200, 400],
    });
  }
}

// Logs go to the Metro terminal in development, which is how alert problems get diagnosed.
const log = (...args: unknown[]) => console.log("[alerts]", ...args);

export async function getAlertPermission(): Promise<AlertPermission> {
  const N = notifications();
  if (!N) return "unavailable";
  try {
    await configure(N);
    const permissions = await N.getPermissionsAsync();
    log("permission:", permissions.status, JSON.stringify(permissions.ios ?? {}));
    return permissions.status === "granted" ? "granted" : "denied";
  } catch (error) {
    log("permission check failed:", describe(error));
    return "unavailable";
  }
}

// Asks for notification permission if it has not been decided yet.
export async function requestAlertPermission(): Promise<AlertPermission> {
  const N = notifications();
  if (!N) return "unavailable";
  try {
    await configure(N);
    const current = await N.getPermissionsAsync();
    log("permission before asking:", current.status, JSON.stringify(current.ios ?? {}));
    if (current.status === "granted") return "granted";
    const asked = await N.requestPermissionsAsync();
    log("permission after asking:", asked.status, JSON.stringify(asked.ios ?? {}));
    return asked.status === "granted" ? "granted" : "denied";
  } catch (error) {
    log("asking for permission failed:", describe(error));
    return "unavailable";
  }
}

export async function cancelRestAlert(): Promise<void> {
  const N = notifications();
  if (!N || scheduledIds.length === 0) return;
  const ids = scheduledIds;
  scheduledIds = [];
  log(`cancelling ${ids.length} pending alert(s)`);
  await Promise.all(
    ids.map((id) =>
      N.cancelScheduledNotificationAsync(id).catch(() => undefined) // already fired or cleared
    )
  );
}

// Clears reminders that already arrived (they stack up on the lock screen) once the user is back.
export async function dismissRestNotifications(): Promise<void> {
  const N = notifications();
  if (!N) return;
  try {
    await N.dismissAllNotificationsAsync();
  } catch {
    // Nothing to clear.
  }
}

export async function scheduleRestAlert(seconds: number, body: string): Promise<AlertResult> {
  const N = notifications();
  await cancelRestAlert();
  if (!N) return { ok: true, message: "Web: the sound plays when the rest ends while this page is open." };
  if (seconds <= 0) return { ok: true, message: "Nothing to schedule." };
  try {
    await configure(N);
    const ids: string[] = [];
    for (const [index, offset] of alertOffsets(seconds).entries()) {
      ids.push(
        await N.scheduleNotificationAsync({
          content: {
            title: index === 0 ? "Rest over" : "Rest over, still waiting",
            body: index === 0 ? body : `Tap to get back to your workout. ${body}`,
            sound: true,
          },
          trigger: {
            type: N.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: offset,
            channelId: CHANNEL_ID,
          },
        })
      );
    }
    scheduledIds = ids;
    const pending = await N.getAllScheduledNotificationsAsync();
    log(`scheduled ${ids.length} alerts starting in ${Math.round(seconds)}s; ${pending.length} pending on the device`);
    return { ok: true, message: "Alert scheduled." };
  } catch (error) {
    await cancelRestAlert();
    log("scheduling failed:", describe(error));
    return { ok: false, message: describe(error) };
  }
}

// --- In-app cue: sound and vibration when the rest ends while the app is open ---

let audio: HTMLAudioElement | null = null;

function audioElement(): HTMLAudioElement | null {
  if (Platform.OS !== "web" || typeof Audio === "undefined") return null;
  if (!audio) {
    const blob = new Blob([buildBeepWav() as BlobPart], { type: "audio/wav" });
    audio = new Audio(URL.createObjectURL(blob));
    audio.preload = "auto";
  }
  return audio;
}

// Browsers only allow sound after a user gesture, so this is called from the "Set done" press:
// play once, muted, so a later programmatic play() when the rest ends is allowed.
export function primeAudio(): void {
  const el = audioElement();
  if (!el) return;
  try {
    el.muted = true;
    const started = el.play();
    const unmute = () => {
      el.pause();
      el.currentTime = 0;
      el.muted = false;
    };
    if (started) started.then(unmute).catch(() => (el.muted = false));
    else unmute();
  } catch {
    el.muted = false;
  }
}

export function playRestEndCue(): void {
  if (Platform.OS !== "web") {
    Vibration.vibrate([0, 400, 200, 400]);
    return;
  }
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate([0, 400, 200, 400]);
  const el = audioElement();
  if (!el) return;
  try {
    el.muted = false;
    el.currentTime = 0;
    void el.play()?.catch(() => undefined);
  } catch {
    // Sound is optional.
  }
}

// Lets someone check on their own device that alerts work, without doing a whole workout.
export async function sendTestAlert(): Promise<AlertResult> {
  if (Platform.OS === "web") {
    primeAudio();
    // A muted prime plays first; give it a moment, then ring for real.
    await new Promise((resolve) => setTimeout(resolve, 300));
    playRestEndCue();
    return {
      ok: true,
      message:
        "You should have heard a sound (and felt a buzz on Android). On the web this only works while the page is open and the screen is on.",
    };
  }
  const permission = await requestAlertPermission();
  if (permission === "denied") {
    return { ok: false, message: "Notifications are turned off for this app. Enable them in your phone's Settings, then try again." };
  }
  if (permission === "unavailable") {
    return { ok: false, message: "Notifications are not available in this environment." };
  }
  const result = await scheduleRestAlert(5, "This is a test alert. Your rest timer alerts will look like this.");
  if (!result.ok) return { ok: false, message: `Could not schedule the alert: ${result.message}` };
  let queued = "";
  try {
    const pending = (await notifications()!.getAllScheduledNotificationsAsync()).length;
    queued = ` (${pending} waiting on this phone)`;
  } catch {
    // Diagnostic only.
  }
  return {
    ok: true,
    message: `Scheduled${queued}. Lock your phone or switch to another app now; the alert should arrive in about 5 seconds and then repeat every few seconds for about a minute, until you open the app. If nothing arrives, check that notifications are on for Expo Go in your phone's Settings, and that Focus / Do Not Disturb is off.`,
  };
}
