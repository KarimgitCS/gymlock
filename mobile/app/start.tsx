import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Button } from "../src/components/Button";
import { usePresets } from "../src/presets/PresetsContext";
import { accentFor, colors, radius, spacing } from "../src/theme";
import type { Preset } from "../src/types";
import { useWorkouts } from "../src/workouts/WorkoutsContext";

function PresetCard({
  preset,
  onStart,
  onEdit,
}: {
  preset: Preset;
  onStart: () => void;
  onEdit: () => void;
}) {
  const accent = accentFor(preset.id);
  return (
    <View style={[styles.card, { borderLeftColor: accent }]}>
      <Pressable
        testID={`preset-start-${preset.id}`}
        accessibilityRole="button"
        accessibilityLabel={`Start ${preset.name}`}
        style={styles.cardBody}
        onPress={onStart}
      >
        <Text style={[styles.cardTitle, { color: accent }]}>{preset.name}</Text>
        {preset.exercises.length === 0 ? (
          <Text style={styles.line}>No exercises</Text>
        ) : (
          preset.exercises.map((e, i) => (
            <View key={i} style={styles.lineRow}>
              <Text style={styles.lineName} numberOfLines={1}>
                {e.name}
              </Text>
              <Text style={styles.lineDetail}>
                {e.sets} × {e.reps} · {e.weight} lb
              </Text>
            </View>
          ))
        )}
      </Pressable>
      <Pressable
        testID={`preset-edit-${preset.id}`}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${preset.name}`}
        onPress={onEdit}
        style={styles.editButton}
      >
        <Text style={styles.editText}>Edit</Text>
      </Pressable>
    </View>
  );
}

export default function StartScreen() {
  const router = useRouter();
  const { presets } = usePresets();
  const { createWorkout, createWorkoutFromPreset } = useWorkouts();
  const [busy, setBusy] = useState(false);

  const open = async (start: () => Promise<{ id: string }>) => {
    if (busy) return;
    setBusy(true);
    try {
      const workout = await start();
      router.replace(`/workout/${workout.id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Saved sessions</Text>

      {presets.map((preset) => (
        <PresetCard
          key={preset.id}
          preset={preset}
          onStart={() => open(() => createWorkoutFromPreset(preset))}
          onEdit={() => router.push(`/preset/${preset.id}`)}
        />
      ))}

      <Pressable
        testID="start-blank"
        accessibilityRole="button"
        style={[styles.card, styles.blankCard]}
        onPress={() => open(createWorkout)}
      >
        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Blank workout</Text>
          <Text style={styles.line}>Start empty and add exercises as you go.</Text>
        </View>
      </Pressable>

      <Button
        title="+ Create new preset"
        variant="secondary"
        onPress={() => router.push("/preset/new")}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm + 2,
  },
  heading: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: spacing.xs,
  },
  card: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 5,
    overflow: "hidden",
  },
  blankCard: {
    borderLeftColor: colors.textMuted,
    borderStyle: "dashed",
  },
  cardBody: {
    flex: 1,
    padding: spacing.md,
    gap: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 2,
  },
  lineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  lineName: {
    color: colors.text,
    fontSize: 14,
    flexShrink: 1,
  },
  lineDetail: {
    color: colors.cyan,
    fontSize: 13,
    fontWeight: "700",
  },
  line: {
    color: colors.textMuted,
    fontSize: 14,
  },
  editButton: {
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  editText: {
    color: colors.pink,
    fontSize: 14,
    fontWeight: "700",
  },
});
