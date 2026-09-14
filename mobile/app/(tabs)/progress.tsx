import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { api } from "../../src/api/client";
import type { Set as LoggedSet } from "../../src/api/types";
import { useAuth } from "../../src/auth/AuthContext";
import { LineChart } from "../../src/components/LineChart";
import { colors, radius, spacing } from "../../src/theme";
import { groupSetsBySession } from "../../src/utils/progress";
import { useWorkouts } from "../../src/workouts/WorkoutsContext";

type Metric = "weight" | "volume";

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export default function ProgressScreen() {
  const { token } = useAuth();
  const { workouts } = useWorkouts();

  const exerciseNames = useMemo(() => {
    const names: string[] = [];
    for (const workout of workouts) {
      for (const exercise of workout.exercises) {
        if (!names.includes(exercise.name)) names.push(exercise.name);
      }
    }
    return names;
  }, [workouts]);

  const [selected, setSelected] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>("weight");
  const [sets, setSets] = useState<LoggedSet[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!selected && exerciseNames.length > 0) setSelected(exerciseNames[0]);
  }, [exerciseNames, selected]);

  useEffect(() => {
    if (!token || !selected) return;
    setIsLoading(true);
    api
      .exerciseHistoryByName(token, selected)
      .then(setSets)
      .finally(() => setIsLoading(false));
  }, [token, selected]);

  const sessions = useMemo(() => groupSetsBySession(sets), [sets]);
  const points = useMemo(
    () =>
      sessions.map((s) => ({
        x: s.date.getTime(),
        y: metric === "weight" ? s.maxWeight : s.volume,
      })),
    [sessions, metric]
  );

  if (exerciseNames.length === 0) {
    return (
      <View style={styles.screen}>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No progress yet</Text>
          <Text style={styles.emptySubtitle}>
            Log a workout with a few sets and your progress will show up here.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {exerciseNames.map((name) => (
          <Chip key={name} label={name} active={name === selected} onPress={() => setSelected(name)} />
        ))}
      </ScrollView>

      <View style={styles.content}>
        <View style={styles.metricRow}>
          <Chip label="Max weight" active={metric === "weight"} onPress={() => setMetric("weight")} />
          <Chip label="Volume" active={metric === "volume"} onPress={() => setMetric("volume")} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{selected}</Text>
          {isLoading ? (
            <Text style={styles.emptySubtitle}>Loading…</Text>
          ) : (
            <LineChart
              points={points}
              formatY={(y) => (metric === "weight" ? `${y} lb` : `${y} lb·reps`)}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  chipRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  chip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "500",
  },
  chipTextActive: {
    color: colors.primaryText,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  metricRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
