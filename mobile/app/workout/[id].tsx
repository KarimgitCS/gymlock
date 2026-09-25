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

import type { Exercise } from "../../src/types";
import { useSettings } from "../../src/settings/SettingsContext";
import { Button } from "../../src/components/Button";
import { RestTimer } from "../../src/components/RestTimer";
import { TextField } from "../../src/components/TextField";
import { accentFor, colors, radius, spacing } from "../../src/theme";
import { formatDate } from "../../src/utils/date";
import { useWorkouts } from "../../src/workouts/WorkoutsContext";

function ExerciseCard({
  exercise,
  onLogSet,
}: {
  exercise: Exercise;
  onLogSet: (exerciseId: number, weight: number, reps: number) => Promise<void>;
}) {
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const weightNum = Number(weight);
  const repsNum = Number(reps);
  const canSubmit =
    weight.trim() !== "" &&
    reps.trim() !== "" &&
    !Number.isNaN(weightNum) &&
    !Number.isNaN(repsNum) &&
    !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onLogSet(exercise.id, weightNum, repsNum);
      setWeight("");
      setReps("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.exerciseCard, { borderLeftColor: accentFor(exercise.name) }]}>
      <Text style={[styles.exerciseName, { color: accentFor(exercise.name) }]}>{exercise.name}</Text>

      {exercise.sets.length > 0 ? (
        <View style={styles.setsTable}>
          {exercise.sets.map((s) => (
            <View key={s.id} style={styles.setRow}>
              <Text style={styles.setLabel}>Set {s.set_number}</Text>
              <Text style={[styles.setValue, { color: colors.cyan }]}>
                {s.weight} lb × {s.reps}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.setInputRow}>
        <TextField
          placeholder="Weight"
          value={weight}
          onChangeText={setWeight}
          keyboardType="decimal-pad"
          style={styles.setInput}
        />
        <TextField
          placeholder="Reps"
          value={reps}
          onChangeText={setReps}
          keyboardType="number-pad"
          style={styles.setInput}
        />
        <Button title="Log" onPress={submit} disabled={!canSubmit} loading={submitting} />
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
            ‹ Back to workouts
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
          title: formatDate(workout.date),
          // After a browser reload there is no history to go back to, so offer a link home.
          headerLeft: router.canGoBack()
            ? undefined
            : () => (
                <Link href="/" style={styles.backLink}>
                  ‹ Workouts
                </Link>
              ),
        }}
      />

      <ScrollView contentContainerStyle={styles.content}>
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
            placeholder="Exercise name (e.g. Bench Press)"
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
  exerciseName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
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
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  setInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  setInput: {
    flex: 1,
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
