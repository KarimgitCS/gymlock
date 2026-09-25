import { Platform, Vibration } from "react-native";
import type * as NotificationsType from "expo-notifications";

// On phones the rest end is scheduled as a local notification with the OS, so the alert still fires
// when the app is backgrounded or the screen is locked. The web falls back to an in-page beep.

const CHANNEL_ID = "rest-timer";
let scheduledId: string | null = null;
let configured = false;

function notifications(): typeof NotificationsType | null {
  if (Platform.OS === "web") return null;
  // Required lazily: the module is not designed for web.
  return require("expo-notifications") as typeof NotificationsType;
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

export async function requestAlertPermission(): Promise<void> {
  const N = notifications();
  if (!N) return;
  try {
    await configure(N);
    const current = await N.getPermissionsAsync();
    if (current.status !== "granted") await N.requestPermissionsAsync();
  } catch {
    // Alerts are a convenience; the on-screen timer works without them.
  }
}

export async function cancelRestAlert(): Promise<void> {
  const N = notifications();
  if (!N || !scheduledId) return;
  const id = scheduledId;
  scheduledId = null;
  try {
    await N.cancelScheduledNotificationAsync(id);
  } catch {
    // Already fired or cleared.
  }
}

export async function scheduleRestAlert(seconds: number, body: string): Promise<void> {
  const N = notifications();
  await cancelRestAlert();
  if (!N || seconds <= 0) return;
  try {
    await configure(N);
    scheduledId = await N.scheduleNotificationAsync({
      content: { title: "Rest over", body, sound: true },
      trigger: {
        type: N.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(seconds)),
        channelId: CHANNEL_ID,
      },
    });
  } catch {
    scheduledId = null;
  }
}

// --- In-app cue when the rest ends while the app is open ---

let audio: AudioContext | null = null;

// Browsers only allow sound after a user gesture, so call this from the "Set done" press.
export function primeAudio(): void {
  if (Platform.OS !== "web") return;
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audio = audio ?? new Ctx();
    void audio.resume();
  } catch {
    audio = null;
  }
}

export function playRestEndCue(): void {
  if (Platform.OS !== "web") {
    Vibration.vibrate([0, 400, 200, 400]);
    return;
  }
  if (!audio) return;
  try {
    [0, 0.28, 0.56].forEach((offset) => {
      const osc = audio!.createOscillator();
      const gain = audio!.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, audio!.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.25, audio!.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audio!.currentTime + offset + 0.22);
      osc.connect(gain).connect(audio!.destination);
      osc.start(audio!.currentTime + offset);
      osc.stop(audio!.currentTime + offset + 0.25);
    });
  } catch {
    // Sound is optional.
  }
}
