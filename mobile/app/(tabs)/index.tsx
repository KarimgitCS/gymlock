import { useRouter } from "expo-router";
import { useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Button } from "../../src/components/Button";
import { colors, radius, spacing } from "../../src/theme";
import type { Workout } from "../../src/api/types";
import { formatDate } from "../../src/utils/date";
import { useWorkouts } from "../../src/workouts/WorkoutsContext";

function setCount(workout: Workout) {
  return workout.exercises.reduce((sum, e) => sum + e.sets.length, 0);
}

function WorkoutCard({ workout, onPress }: { workout: Workout; onPress: () => void }) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardDate}>{formatDate(workout.date)}</Text>
        <Text style={styles.cardMeta}>
          {workout.exercises.length} exercise{workout.exercises.length === 1 ? "" : "s"} ·{" "}
          {setCount(workout)} set{setCount(workout) === 1 ? "" : "s"}
        </Text>
      </View>
      {workout.notes ? <Text style={styles.cardNotes}>{workout.notes}</Text> : null}
      {workout.exercises.length > 0 ? (
        <Text style={styles.cardExercises} numberOfLines={1}>
          {workout.exercises.map((e) => e.name).join(", ")}
        </Text>
      ) : null}
    </Pressable>
  );
}

export default function WorkoutsScreen() {
  const router = useRouter();
  const { workouts, isLoading, error, refresh, createWorkout } = useWorkouts();
  const [creating, setCreating] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

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
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={colors.text} />
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No workouts yet</Text>
              <Text style={styles.emptySubtitle}>
                Start your first workout to begin tracking sets and reps.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <WorkoutCard workout={item} onPress={() => router.push(`/workout/${item.id}`)} />
        )}
      />
      <View style={styles.footer}>
        {startError || error ? (
          <Text style={styles.error}>{startError ?? error}</Text>
        ) : null}
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardDate: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  cardMeta: {
    color: colors.textMuted,
    fontSize: 13,
  },
  cardNotes: {
    color: colors.textMuted,
    fontSize: 14,
  },
  cardExercises: {
    color: colors.primary,
    fontSize: 13,
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
    paddingTop: spacing.xl * 2,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "600",
  },
  emptySubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
  },
});
