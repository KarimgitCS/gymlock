import { useRouter } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "../../src/components/Button";
import { accentFor, colors, radius, spacing } from "../../src/theme";
import type { Workout } from "../../src/types";
import { formatDate } from "../../src/utils/date";
import { useWorkouts } from "../../src/workouts/WorkoutsContext";

function setCount(workout: Workout) {
  return workout.exercises.reduce((sum, e) => sum + e.sets.length, 0);
}

function StatTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.statTile, { borderColor: color }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function WorkoutCard({ workout, onPress }: { workout: Workout; onPress: () => void }) {
  const accent = accentFor(workout.id);
  const sets = setCount(workout);
  return (
    <Pressable style={[styles.card, { borderLeftColor: accent }]} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardDate, { color: accent }]}>{formatDate(workout.date)}</Text>
        <Text style={styles.cardMeta}>
          {workout.exercises.length} exercise{workout.exercises.length === 1 ? "" : "s"} · {sets} set
          {sets === 1 ? "" : "s"}
        </Text>
      </View>
      {workout.exercises.length > 0 ? (
        <View style={styles.pillRow}>
          {workout.exercises.map((e) => (
            <View key={e.id} style={[styles.pill, { backgroundColor: accentFor(e.name) + "26" }]}>
              <Text style={[styles.pillText, { color: accentFor(e.name) }]}>{e.name}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.cardMeta}>No exercises yet</Text>
      )}
    </Pressable>
  );
}

export default function WorkoutsScreen() {
  const router = useRouter();
  const { workouts, isLoading, createWorkout } = useWorkouts();
  const [creating, setCreating] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const totalSets = workouts.reduce((sum, w) => sum + setCount(w), 0);
  const totalVolume = workouts.reduce(
    (sum, w) =>
      sum + w.exercises.reduce((s, e) => s + e.sets.reduce((v, set) => v + set.weight * set.reps, 0), 0),
    0
  );

  const startWorkout = async () => {
    setCreating(true);
    setStartError(null);
    try {
      const workout = await createWorkout();
      router.push(`/workout/${workout.id}`);
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "Could not start a workout");
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={styles.screen}>
      <FlatList
        data={workouts}
        keyExtractor={(w) => String(w.id)}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.statsRow}>
            <StatTile label="Workouts" value={String(workouts.length)} color={colors.pink} />
            <StatTile label="Sets" value={String(totalSets)} color={colors.cyan} />
            <StatTile
              label="Volume (lb)"
              value={totalVolume >= 10000 ? `${(totalVolume / 1000).toFixed(1)}k` : String(Math.round(totalVolume))}
              color={colors.orange}
            />
          </View>
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>💪</Text>
              <Text style={styles.emptyTitle}>Ready when you are</Text>
              <Text style={styles.emptySubtitle}>
                Start your first workout to track sets and reps. Everything is saved on this device.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <WorkoutCard workout={item} onPress={() => router.push(`/workout/${item.id}`)} />
        )}
      />
      <View style={styles.footer}>
        {startError ? <Text style={styles.error}>{startError}</Text> : null}
        <Button title="Start workout" onPress={startWorkout} loading={creating} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.sm,
    flexGrow: 1,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "800",
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
    fontWeight: "600",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 5,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardDate: {
    fontSize: 17,
    fontWeight: "700",
  },
  cardMeta: {
    color: colors.textMuted,
    fontSize: 13,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs + 2,
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    marginBottom: spacing.sm,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  emptyEmoji: {
    fontSize: 44,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  emptySubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
  },
});
