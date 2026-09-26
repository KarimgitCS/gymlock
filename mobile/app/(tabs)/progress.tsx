import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { LineChart } from "../../src/components/LineChart";
import { accentFor, colors, radius, spacing } from "../../src/theme";
import { isFinished } from "../../src/utils/history";
import { groupSetsBySession } from "../../src/utils/progress";
import { useWorkouts } from "../../src/workouts/WorkoutsContext";

type Metric = "weight" | "volume";

function Chip({
  label,
  active,
  color,
  onPress,
}: {
  label: string;
  active: boolean;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.chip, { borderColor: color }, active && { backgroundColor: color }]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, { color: active ? colors.background : color }]}>{label}</Text>
    </Pressable>
  );
}

export default function ProgressScreen() {
  const { workouts, getSetsForExercise } = useWorkouts();

  const exerciseNames = useMemo(() => {
    const names: string[] = [];
    for (const workout of workouts.filter(isFinished)) {
      for (const exercise of workout.exercises) {
        if (exercise.sets.length === 0) continue;
        if (!names.some((n) => n.toLowerCase() === exercise.name.toLowerCase())) {
          names.push(exercise.name);
        }
      }
    }
    return names;
  }, [workouts]);

  const [selected, setSelected] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>("weight");

  useEffect(() => {
    if (exerciseNames.length === 0) setSelected(null);
    else if (!selected || !exerciseNames.includes(selected)) setSelected(exerciseNames[0]);
  }, [exerciseNames, selected]);

  const points = useMemo(() => {
    if (!selected) return [];
    return groupSetsBySession(getSetsForExercise(selected)).map((s) => ({
      x: s.date.getTime(),
      y: metric === "weight" ? s.maxWeight : s.volume,
    }));
  }, [selected, metric, getSetsForExercise]);

  if (exerciseNames.length === 0) {
    return (
      <View style={styles.screen}>
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📈</Text>
          <Text style={styles.emptyTitle}>No progress yet</Text>
          <Text style={styles.emptySubtitle}>
            Log a workout with a few sets and your progress will show up here.
          </Text>
        </View>
      </View>
    );
  }

  const accent = accentFor(selected ?? "");

  return (
    <View style={styles.screen}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipRow}
      >
        {exerciseNames.map((name) => (
          <Chip
            key={name}
            label={name}
            color={accentFor(name)}
            active={name === selected}
            onPress={() => setSelected(name)}
          />
        ))}
      </ScrollView>

      <View style={styles.content}>
        <View style={styles.metricRow}>
          <Chip label="Max weight" color={colors.cyan} active={metric === "weight"} onPress={() => setMetric("weight")} />
          <Chip label="Volume" color={colors.orange} active={metric === "volume"} onPress={() => setMetric("volume")} />
        </View>

        <View style={[styles.card, { borderTopColor: accent }]}>
          <Text style={[styles.cardTitle, { color: accent }]}>{selected}</Text>
          <LineChart
            points={points}
            color={accent}
            formatY={(y) => (metric === "weight" ? `${y} lb` : `${y} lb·reps`)}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chipScroll: {
    flexGrow: 0,
  },
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
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "700",
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
    borderTopWidth: 4,
    padding: spacing.md,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "800",
    marginBottom: spacing.sm,
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
