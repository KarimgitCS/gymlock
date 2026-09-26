import { Platform, Vibration } from "react-native";

import { playRestEndCue } from "./restAlerts";
import { ALARM_MAX_MS } from "./schedule";

// The alarm that runs while the app is open when a rest ends: it keeps going until the user
// acknowledges it (Set done, Skip, or Stop alarm), then stops on its own after a minute.
// It is what makes the end of a rest hard to miss, unlike a single buzz.
//
// Phones: a looping alarm sound (played even with the silent switch on) plus strong haptic pulses.
// Web: the beep and vibration repeat.

interface AudioPlayerLike {
  loop: boolean;
  volume: number;
  play(): void;
  pause(): void;
  remove(): void;
}

let pulseTimer: ReturnType<typeof setInterval> | null = null;
let autoStopTimer: ReturnType<typeof setTimeout> | null = null;
let player: AudioPlayerLike | null = null;
let active = false;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

export const isRestAlarmActive = () => active;

export function subscribeRestAlarm(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function startNativeSound() {
  try {
    const Audio = require("expo-audio") as typeof import("expo-audio");
    // Without this, iOS mutes the sound whenever the silent switch is on.
    void Audio.setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false });
    const created = Audio.createAudioPlayer(require("../../assets/rest-over.wav")) as unknown as AudioPlayerLike;
    created.loop = true;
    created.volume = 1;
    created.play();
    player = created;
  } catch (error) {
    console.log("[alerts] alarm sound failed:", error instanceof Error ? error.message : String(error));
  }
}

function pulseNative() {
  try {
    const Haptics = require("expo-haptics") as typeof import("expo-haptics");
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {
    Vibration.vibrate();
  }
}

export function startRestAlarm(): void {
  if (active) return;
  active = true;
  notify();

  if (Platform.OS === "web") {
    playRestEndCue();
    pulseTimer = setInterval(playRestEndCue, 1800);
  } else {
    startNativeSound();
    pulseNative();
    pulseTimer = setInterval(pulseNative, 900);
  }
  autoStopTimer = setTimeout(stopRestAlarm, ALARM_MAX_MS);
}

export function stopRestAlarm(): void {
  if (!active) return;
  active = false;
  if (pulseTimer) clearInterval(pulseTimer);
  if (autoStopTimer) clearTimeout(autoStopTimer);
  pulseTimer = null;
  autoStopTimer = null;
  if (player) {
    try {
      player.pause();
      player.remove();
    } catch {
      // Already released.
    }
    player = null;
  }
  notify();
}
