import { Link, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Button } from "../../src/components/Button";
import { NumberPicker } from "../../src/components/NumberPicker";
import { RestTimer } from "../../src/components/RestTimer";
import { TextField } from "../../src/components/TextField";
import {
  DEFAULT_REPS,
  DEFAULT_WEIGHT,
  REPS_OPTIONS,
  WEIGHT_OPTIONS,
} from "../../src/constants";
import { useSettings } from "../../src/settings/SettingsContext";
import { accentFor, colors, radius, spacing } from "../../src/theme";
import type { Exercise } from "../../src/types";
import { formatDate } from "../../src/utils/date";
import { useWorkouts } from "../../src/workouts/WorkoutsContext";

function ExerciseCard({
  exercise,
  onLogSet,
}: {
  exercise: Exercise;
  onLogSet: (exerciseId: number, weight: number, reps: number) => Promise<void>;
}) {
  const plan = exercise.plan ?? null;
  const [weight, setWeight] = useState(plan?.weight ?? DEFAULT_WEIGHT);
  const [reps, setReps] = useState(plan?.reps ?? DEFAULT_REPS);
  const [submitting, setSubmitting] = useState(false);

  const accent = accentFor(exercise.name);
  const logged = exercise.sets.length;
  const done = plan !== null && logged >= plan.sets;

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onLogSet(exercise.id, weight, reps);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.exerciseCard, { borderLeftColor: accent }]}>
      <View style={styles.exerciseHeader}>
        <Text style={[styles.exerciseName, { color: accent }]}>{exercise.name}</Text>
        {plan ? (
          <View style={[styles.progressChip, done && styles.progressChipDone]}>
            <Text style={[styles.progressText, done && { color: colors.background }]}>
              {done ? "✓ Done" : `Set ${logged + 1} of ${plan.sets}`}
            </Text>
          </View>
        ) : null}
      </View>

      {plan ? (
        <Text style={styles.planText}>
          Plan: {plan.sets} × {plan.reps} at {plan.weight} lb
        </Text>
      ) : null}

      {exercise.sets.length > 0 ? (
        <View style={styles.setsTable}>
          {exercise.sets.map((s) => (
            <View key={s.id} style={styles.setRow}>
              <Text style={styles.setLabel}>Set {s.set_number}</Text>
              <Text style={styles.setValue}>
                {s.weight} lb × {s.reps}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.setInputRow}>
        <NumberPicker
          label="Weight"
          value={weight}
          options={WEIGHT_OPTIONS}
          unit="lb"
          onChange={setWeight}
          accent={colors.orange}
          testID={`log-${exercise.id}-weight`}
        />
        <NumberPicker
          label="Reps"
          value={reps}
          options={REPS_OPTIONS}
          onChange={setReps}
          accent={colors.cyan}
          testID={`log-${exercise.id}-reps`}
        />
        <View style={styles.logButton}>
          <Button
            title={done ? "Log extra" : "Log set"}
            onPress={submit}
            loading={submitting}
          />
        </View>
      </View>
    </View>
  );
}

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const workoutId = Number(id);
  const router = useRouter();
  const { restTimerSeconds: restDuration } = useSettings();
  const { getWorkout, isLoading, addExercise, logSet } = useWorkouts();
  const workout = getWorkout(workoutId);

  const [exerciseName, setExerciseName] = useState("");
  const [addingExercise, setAddingExercise] = useState(false);
  const [restTimerKey, setRestTimerKey] = useState<number | null>(null);

  const onLogSet = async (exerciseId: number, weight: number, reps: number) => {
    await logSet(exerciseId, weight, reps);
    setRestTimerKey(Date.now());
  };

  const onAddExercise = async () => {
    if (!exerciseName.trim()) return;
    setAddingExercise(true);
    try {
      await addExercise(workoutId, exerciseName.trim());
      setExerciseName("");
    } finally {
      setAddingExercise(false);
    }
  };

  if (!workout) {
    return (
      <View style={styles.screen}>
        <Text style={styles.emptyText}>{isLoading ? "Loading workout…" : "Workout not found"}</Text>
        {isLoading ? null : (
          <Link href="/" style={styles.notFoundLink}>
            ‹ Back to home
          </Link>
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen
        options={{
          title: workout.name || formatDate(workout.date),
          // After a browser reload there is no history to go back to, so offer a link home.
          headerLeft: router.canGoBack()
            ? undefined
            : () => (
                <Link href="/" style={styles.backLink}>
                  ‹ Home
                </Link>
              ),
        }}
      />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {workout.name ? <Text style={styles.dateLine}>{formatDate(workout.date)}</Text> : null}

        {workout.exercises.length === 0 ? (
          <Text style={styles.emptyText}>
            Add your first exercise below to start logging sets.
          </Text>
        ) : null}

        {workout.exercises.map((exercise) => (
          <ExerciseCard key={exercise.id} exercise={exercise} onLogSet={onLogSet} />
        ))}

        <View style={styles.addExerciseRow}>
          <TextField
            placeholder="Add another exercise"
            value={exerciseName}
            onChangeText={setExerciseName}
            style={styles.addExerciseInput}
          />
          <Button
            title="Add"
            onPress={onAddExercise}
            disabled={!exerciseName.trim()}
            loading={addingExercise}
          />
        </View>
      </ScrollView>

      {restTimerKey ? (
        <View style={styles.timerWrapper}>
          <RestTimer
            key={restTimerKey}
            durationSeconds={restDuration}
            onDismiss={() => setRestTimerKey(null)}
          />
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  notFoundLink: {
    color: colors.pink,
    fontSize: 16,
    textAlign: "center",
    marginTop: spacing.md,
  },
  backLink: {
    color: colors.pink,
    fontSize: 16,
    fontWeight: "700",
    paddingHorizontal: spacing.sm,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  dateLine: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    marginTop: spacing.lg,
  },
  exerciseCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 5,
    padding: spacing.md,
    gap: spacing.sm,
  },
  exerciseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: "800",
    flexShrink: 1,
  },
  progressChip: {
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.pink,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  progressChipDone: {
    backgroundColor: colors.mint,
    borderColor: colors.mint,
  },
  progressText: {
    color: colors.pink,
    fontSize: 12,
    fontWeight: "800",
  },
  planText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  setsTable: {
    gap: spacing.xs,
  },
  setRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  setLabel: {
    color: colors.textMuted,
    fontSize: 13,
  },
  setValue: {
    color: colors.cyan,
    fontSize: 14,
    fontWeight: "700",
  },
  setInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  logButton: {
    flex: 1.1,
  },
  addExerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  addExerciseInput: {
    flex: 1,
  },
  timerWrapper: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
