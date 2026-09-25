import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, Vibration, View } from "react-native";

import { useRestTimer } from "../hooks/useRestTimer";
import { colors, radius, spacing } from "../theme";

interface RestTimerProps {
  durationSeconds?: number;
  onDismiss: () => void;
}

export function RestTimer({ durationSeconds = 90, onDismiss }: RestTimerProps) {
  const { remaining, isDone, addSeconds } = useRestTimer(durationSeconds);
  const [totalSeconds, setTotalSeconds] = useState(durationSeconds);
  const hasVibratedRef = useRef(false);

  useEffect(() => {
    if (isDone && !hasVibratedRef.current) {
      hasVibratedRef.current = true;
      Vibration.vibrate(400);
    }
  }, [isDone]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  const fraction = Math.min(1, Math.max(0, remaining / totalSeconds));

  return (
    <View style={[styles.container, isDone && styles.containerDone]}>
      <View style={styles.row}>
      <View>
        <Text style={styles.label}>{isDone ? "Rest complete" : "Resting"}</Text>
        <Text style={styles.time}>
          {minutes}:{seconds.toString().padStart(2, "0")}
        </Text>
      </View>
      <View style={styles.actions}>
        {!isDone ? (
          <Pressable
            style={styles.chip}
            onPress={() => {
              addSeconds(30);
              setTotalSeconds((t) => t + 30);
            }}
          >
            <Text style={styles.chipText}>+30s</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.chip} onPress={onDismiss}>
          <Text style={styles.chipText}>{isDone ? "Done" : "Skip"}</Text>
        </Pressable>
      </View>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${fraction * 100}%`, backgroundColor: isDone ? colors.mint : colors.pink },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    padding: spacing.md,
  },
  containerDone: {
    borderColor: colors.mint,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  fill: {
    height: 6,
    borderRadius: 3,
  },
  label: {
    color: colors.pink,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  time: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm,
  },
  chipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
});
