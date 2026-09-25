import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Button } from "../components/Button";
import { NumberPicker } from "../components/NumberPicker";
import { DEFAULT_REPS, DEFAULT_SETS, DEFAULT_WEIGHT, REST_OPTIONS } from "../constants";
import { useSettings } from "../settings/SettingsContext";
import { requestAlertPermission } from "../timers/restAlerts";
import { colors, radius, spacing } from "../theme";
import type { Workout } from "../types";
import { useWorkouts } from "../workouts/WorkoutsContext";
import { ExercisePlanEditor } from "./ExercisePlanEditor";

// Step one: lay out the whole workout. Nothing runs (no sets, no timers) until "Begin workout".
export function WorkoutSetup({ workout }: { workout: Workout }) {
  const router = useRouter();
  const { restTimerSeconds, setRestTimerSeconds } = useSettings();
  const { addExercise, updateExercise, removeExercise, beginWorkout, deleteWorkout } = useWorkouts();
  const [error, setError] = useState<string | null>(null);

  const totalSets = workout.exercises.reduce((sum, e) => sum + (e.plan?.sets ?? 0), 0);

  const onBegin = async () => {
    setError(null);
    if (workout.exercises.length === 0) return setError("Add at least one exercise first.");
    if (workout.exercises.some((e) => !e.name.trim())) return setError("Every exercise needs a name.");
    // Ask for alert permission now, while the user is deciding to start, not mid-workout.
    await requestAlertPermission();
    await beginWorkout(workout.id);
  };

  const onCancel = async () => {
    await deleteWorkout(workout.id);
    router.replace("/");
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.intro}>
        <Text style={styles.title}>{workout.name || "New workout"}</Text>
        <Text style={styles.subtitle}>
          Set everything up first. The workout and its timers only start when you press Begin.
        </Text>
      </View>

      {workout.exercises.map((exercise, index) => (
        <ExercisePlanEditor
          key={exercise.id}
          index={index}
          values={{
            name: exercise.name,
            sets: exercise.plan?.sets ?? DEFAULT_SETS,
            reps: exercise.plan?.reps ?? DEFAULT_REPS,
            weight: exercise.plan?.weight ?? DEFAULT_WEIGHT,
          }}
          onChange={(patch) => {
            const current = {
              sets: exercise.plan?.sets ?? DEFAULT_SETS,
              reps: exercise.plan?.reps ?? DEFAULT_REPS,
              weight: exercise.plan?.weight ?? DEFAULT_WEIGHT,
            };
            const { name, ...planPatch } = patch;
            updateExercise(workout.id, exercise.id, {
              ...(name !== undefined ? { name } : {}),
              ...(Object.keys(planPatch).length ? { plan: { ...current, ...planPatch } } : {}),
            });
          }}
          onRemove={() => removeExercise(workout.id, exercise.id)}
        />
      ))}

      <Button
        title="+ Add exercise"
        variant="secondary"
        onPress={() =>
          addExercise(workout.id, "", { sets: DEFAULT_SETS, reps: DEFAULT_REPS, weight: DEFAULT_WEIGHT })
        }
      />

      <View style={styles.restCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.restTitle}>Rest between sets</Text>
          <Text style={styles.restNote}>
            Starts only when you press Set done. On a phone it alerts you even if the app is closed.
          </Text>
        </View>
        <View style={styles.restPicker}>
          <NumberPicker
            label="Rest"
            value={restTimerSeconds}
            options={REST_OPTIONS}
            unit="s"
            onChange={setRestTimerSeconds}
            accent={colors.mint}
            testID="setup-rest"
          />
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.summary}>
        {workout.exercises.length} exercise{workout.exercises.length === 1 ? "" : "s"} · {totalSets} sets
      </Text>
      <Button title="Begin workout" onPress={onBegin} />
      <Button title="Cancel workout" variant="secondary" onPress={onCancel} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  intro: {
    gap: 4,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  restCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 5,
    borderLeftColor: colors.mint,
    padding: spacing.md,
  },
  restTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  restNote: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  restPicker: {
    width: 120,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "600",
  },
  summary: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    fontWeight: "600",
  },
});
