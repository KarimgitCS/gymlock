import { useRouter } from "expo-router";
import { useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { DeleteWorkoutButton } from "../../src/components/DeleteWorkoutButton";
import { accentFor, colors, radius, spacing } from "../../src/theme";
import { formatWorkoutWhen, historyEntries, type HistoryEntry } from "../../src/utils/history";
import { useWorkouts } from "../../src/workouts/WorkoutsContext";

function meta(entry: HistoryEntry): string {
  const parts = [`${entry.sets} set${entry.sets === 1 ? "" : "s"}`, `${entry.volume.toLocaleString()} lb`];
  if (entry.minutes) parts.push(`${entry.minutes} min`);
  return parts.join(" · ");
}

export default function HistoryScreen() {
  const router = useRouter();
  const { workouts, deleteWorkout } = useWorkouts();
  const entries = useMemo(() => historyEntries(workouts), [workouts]);

  if (entries.length === 0) {
    return (
      <View style={styles.screen}>
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📅</Text>
          <Text style={styles.emptyTitle}>No workouts logged yet</Text>
          <Text style={styles.emptySubtitle}>
            Finished workouts show up here with their date, so you can review them or remove ones you do not want.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={entries}
        keyExtractor={(entry) => entry.workout.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={styles.note}>
            Deleting a workout also removes it from your progress charts.
          </Text>
        }
        renderItem={({ item }) => {
          const { workout } = item;
          const accent = accentFor(workout.name || "Workout");
          return (
            <View testID={`history-item-${workout.id}`} style={[styles.card, { borderLeftColor: accent }]}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/workout/${workout.id}`)}
                style={styles.cardBody}
              >
                <View style={styles.titleRow}>
                  <Text style={[styles.name, { color: accent }]} numberOfLines={1}>
                    {workout.name || "Workout"}
                  </Text>
                  {item.endedEarly ? (
                    <Text style={styles.badge}>
                      Ended early · {item.sets}/{item.plannedSets}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.when}>{formatWorkoutWhen(workout)}</Text>
                {workout.exercises.length > 0 ? (
                  <Text style={styles.exercises} numberOfLines={1}>
                    {workout.exercises.map((e) => e.name).join(", ")}
                  </Text>
                ) : null}
                <Text style={styles.meta}>{meta(item)}</Text>
              </Pressable>
              <DeleteWorkoutButton
                compact
                testID={`history-delete-${workout.id}`}
                onDelete={() => void deleteWorkout(workout.id)}
              />
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    padding: spacing.md,
    gap: spacing.sm + 2,
  },
  note: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 5,
    padding: spacing.md,
  },
  cardBody: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  name: {
    fontSize: 17,
    fontWeight: "800",
    flexShrink: 1,
  },
  badge: {
    color: colors.orange,
    fontSize: 11,
    fontWeight: "800",
  },
  when: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  exercises: {
    color: colors.textMuted,
    fontSize: 13,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
