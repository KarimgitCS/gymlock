import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Button } from "../components/Button";
import { cancelRestAlert } from "../timers/restAlerts";
import { accentFor, colors, radius, spacing } from "../theme";
import type { Workout } from "../types";
import { workoutVolume } from "../utils/workoutProgress";

function duration(workout: Workout): string | null {
  if (!workout.started_at || !workout.finished_at) return null;
  const minutes = Math.max(1, Math.round((Date.parse(workout.finished_at) - Date.parse(workout.started_at)) / 60000));
  return `${minutes} min`;
}

export function WorkoutSummary({ workout }: { workout: Workout }) {
  const router = useRouter();
  const sets = workout.exercises.reduce((sum, e) => sum + e.sets.length, 0);
  const time = duration(workout);

  useEffect(() => {
    void cancelRestAlert();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.emoji}>🎉</Text>
        <Text style={styles.title}>Workout complete</Text>
        <Text style={styles.subtitle}>{workout.name || "Workout"}</Text>
      </View>

      <View style={styles.stats}>
        <View style={[styles.stat, { borderColor: colors.pink }]}>
          <Text style={[styles.statValue, { color: colors.pink }]}>{sets}</Text>
          <Text style={styles.statLabel}>Sets</Text>
        </View>
        <View style={[styles.stat, { borderColor: colors.orange }]}>
          <Text style={[styles.statValue, { color: colors.orange }]}>{Math.round(workoutVolume(workout))}</Text>
          <Text style={styles.statLabel}>Volume (lb)</Text>
        </View>
        {time ? (
          <View style={[styles.stat, { borderColor: colors.cyan }]}>
            <Text style={[styles.statValue, { color: colors.cyan }]}>{time}</Text>
            <Text style={styles.statLabel}>Time</Text>
          </View>
        ) : null}
      </View>

      {workout.exercises.map((e) => (
        <View key={e.id} style={[styles.card, { borderLeftColor: accentFor(e.name) }]}>
          <Text style={[styles.cardTitle, { color: accentFor(e.name) }]}>{e.name}</Text>
          {e.sets.length === 0 ? (
            <Text style={styles.muted}>No sets logged</Text>
          ) : (
            e.sets.map((s) => (
              <View key={s.id} style={styles.setRow}>
                <Text style={styles.muted}>Set {s.set_number}</Text>
                <Text style={styles.setValue}>
                  {s.weight} lb × {s.reps}
                </Text>
              </View>
            ))
          )}
        </View>
      ))}

      <Button title="Back to home" onPress={() => router.replace("/")} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  hero: {
    alignItems: "center",
    gap: 4,
    paddingVertical: spacing.md,
  },
  emoji: {
    fontSize: 48,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
  },
  stats: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 5,
    padding: spacing.md,
    gap: spacing.xs + 2,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  setRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  muted: {
    color: colors.textMuted,
    fontSize: 13,
  },
  setValue: {
    color: colors.cyan,
    fontSize: 14,
    fontWeight: "700",
  },
});
