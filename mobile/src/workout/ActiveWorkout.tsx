import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Button } from "../components/Button";
import { NumberPicker } from "../components/NumberPicker";
import { REPS_OPTIONS, WEIGHT_OPTIONS } from "../constants";
import { useRestTimer } from "../hooks/useRestTimer";
import { useSettings } from "../settings/SettingsContext";
import { cancelRestAlert, playRestEndCue, primeAudio, scheduleRestAlert } from "../timers/restAlerts";
import { accentFor, colors, radius, spacing } from "../theme";
import type { Exercise, Workout } from "../types";
import { describeNextAfterSet, describeTarget, getWorkoutProgress } from "../utils/workoutProgress";
import { useWorkouts } from "../workouts/WorkoutsContext";

function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// The set to do now. Weight and reps start from the plan (or the last set) and can be adjusted.
function SetPanel({
  exercise,
  setNumber,
  restOver,
  onDone,
}: {
  exercise: Exercise;
  setNumber: number;
  restOver: boolean;
  onDone: (weight: number, reps: number) => Promise<void>;
}) {
  const plan = exercise.plan!;
  const last = exercise.sets[exercise.sets.length - 1];
  const [weight, setWeight] = useState(last?.weight ?? plan.weight);
  const [reps, setReps] = useState(plan.reps);
  const [busy, setBusy] = useState(false);
  const accent = accentFor(exercise.name);

  const press = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onDone(weight, reps);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.panel, { borderTopColor: accent }]}>
      {restOver ? (
        <View style={styles.restOverBanner} testID="rest-over">
          <Text style={styles.restOverText}>Rest over — you're up</Text>
        </View>
      ) : null}
      <Text style={styles.kicker}>Now</Text>
      <Text style={[styles.exerciseName, { color: accent }]}>{exercise.name}</Text>
      <Text style={styles.setLine}>
        Set {setNumber} of {plan.sets}
      </Text>
      <Text style={styles.planLine}>
        Plan: {plan.reps} reps at {plan.weight} lb
      </Text>

      <View style={styles.pickerRow}>
        <NumberPicker
          label="Weight"
          value={weight}
          options={WEIGHT_OPTIONS}
          unit="lb"
          onChange={setWeight}
          accent={colors.orange}
          testID="active-weight"
        />
        <NumberPicker
          label="Reps"
          value={reps}
          options={REPS_OPTIONS}
          onChange={setReps}
          accent={colors.cyan}
          testID="active-reps"
        />
      </View>

      <View testID="set-done"><Button title="Set done" onPress={press} loading={busy} /></View>
      <Text style={styles.hint}>The rest timer starts when you press this.</Text>
    </View>
  );
}

function RestPanel({
  remaining,
  total,
  nextUp,
  onAdd,
  onSkip,
}: {
  remaining: number;
  total: number;
  nextUp: string | null;
  onAdd: () => void;
  onSkip: () => void;
}) {
  const fraction = Math.min(1, Math.max(0, remaining / Math.max(1, total)));
  return (
    <View style={[styles.panel, { borderTopColor: colors.pink }]} testID="rest-panel">
      <Text style={styles.kicker}>Rest</Text>
      <Text style={styles.clock} testID="rest-clock">
        {formatClock(remaining)}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${fraction * 100}%` }]} />
      </View>
      {nextUp ? (
        <View style={styles.nextBox}>
          <Text style={styles.nextLabel}>Up next</Text>
          <Text style={styles.nextText}>{nextUp}</Text>
        </View>
      ) : null}
      <View style={styles.restButtons}>
        <View style={{ flex: 1 }}>
          <Button title="+30 s" variant="secondary" onPress={onAdd} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Skip rest" onPress={onSkip} />
        </View>
      </View>
    </View>
  );
}

// Step two: work through the planned sets one at a time.
export function ActiveWorkout({ workout }: { workout: Workout }) {
  const router = useRouter();
  const { restTimerSeconds } = useSettings();
  const { completeSet, setRest, finishWorkout, deleteWorkout } = useWorkouts();
  const [confirmEnd, setConfirmEnd] = useState(false);

  const progress = getWorkoutProgress(workout);
  const rest = workout.rest ?? null;
  const { remaining, isRunning } = useRestTimer(rest?.ends_at ?? null, playRestEndCue);
  const restOver = rest !== null && !isRunning;
  const current = progress.current;
  const nextUp = current?.plan
    ? describeTarget(
        current,
        progress.setNumber,
        current.sets[current.sets.length - 1]?.weight ?? current.plan.weight,
        current.plan.reps
      )
    : null;

  const onSetDone = async (weight: number, reps: number) => {
    if (!current) return;
    primeAudio();
    const upcoming = describeNextAfterSet(workout, current.id);
    const { finished } = await completeSet(workout.id, current.id, weight, reps, restTimerSeconds);
    if (finished || !upcoming) await cancelRestAlert();
    else await scheduleRestAlert(restTimerSeconds, `Next: ${upcoming}`);
  };

  const addThirty = async () => {
    if (!rest) return;
    await setRest(workout.id, { ends_at: rest.ends_at + 30000, total: rest.total + 30 });
    if (nextUp) await scheduleRestAlert(remaining + 30, `Next: ${nextUp}`);
  };

  const skipRest = async () => {
    await cancelRestAlert();
    await setRest(workout.id, null);
  };

  const endEarly = async () => {
    if (!confirmEnd) return setConfirmEnd(true);
    await cancelRestAlert();
    if (progress.doneSets === 0) {
      await deleteWorkout(workout.id);
      router.replace("/");
    } else {
      await finishWorkout(workout.id);
    }
  };

  const overall = progress.totalSets ? progress.doneSets / progress.totalSets : 0;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.overall}>
        <View style={styles.overallRow}>
          <Text style={styles.overallTitle}>{workout.name || "Workout"}</Text>
          <Text style={styles.overallCount} testID="overall-count">
            {progress.doneSets}/{progress.totalSets} sets
          </Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${overall * 100}%`, backgroundColor: colors.mint }]} />
        </View>
      </View>

      {isRunning && rest ? (
        <RestPanel
          remaining={remaining}
          total={rest.total}
          nextUp={nextUp}
          onAdd={addThirty}
          onSkip={skipRest}
        />
      ) : current ? (
        <SetPanel
          key={`${current.id}-${progress.setNumber}`}
          exercise={current}
          setNumber={progress.setNumber}
          restOver={restOver}
          onDone={onSetDone}
        />
      ) : null}

      <View style={styles.list}>
        {workout.exercises.map((e) => {
          const planned = e.plan?.sets ?? e.sets.length;
          const done = e.sets.length >= planned;
          const isCurrent = current?.id === e.id;
          return (
            <View key={e.id} style={[styles.listRow, isCurrent && styles.listRowCurrent]}>
              <Text style={[styles.listName, done && styles.listNameDone]} numberOfLines={1}>
                {done ? "✓ " : ""}
                {e.name}
              </Text>
              <Text style={[styles.listCount, { color: done ? colors.mint : accentFor(e.name) }]}>
                {Math.min(e.sets.length, planned)}/{planned}
              </Text>
            </View>
          );
        })}
      </View>

      <Pressable
        testID="end-workout"
        accessibilityRole="button"
        onPress={endEarly}
        style={[styles.endButton, confirmEnd && styles.endConfirm]}
      >
        <Text style={[styles.endText, confirmEnd && { color: colors.background }]}>
          {confirmEnd ? "Tap again to end the workout" : "End workout early"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  overall: {
    gap: spacing.xs + 2,
  },
  overallRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  overallTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  overallCount: {
    color: colors.mint,
    fontSize: 14,
    fontWeight: "800",
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  fill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.pink,
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 5,
    padding: spacing.lg - 4,
    gap: spacing.sm + 2,
  },
  restOverBanner: {
    backgroundColor: colors.mint,
    borderRadius: radius.sm,
    paddingVertical: 6,
    alignItems: "center",
  },
  restOverText: {
    color: colors.background,
    fontWeight: "800",
    fontSize: 14,
  },
  kicker: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  exerciseName: {
    fontSize: 28,
    fontWeight: "800",
  },
  setLine: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  planLine: {
    color: colors.textMuted,
    fontSize: 13,
  },
  pickerRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: "center",
  },
  clock: {
    color: colors.text,
    fontSize: 72,
    fontWeight: "800",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  nextBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md - 4,
    gap: 2,
  },
  nextLabel: {
    color: colors.pink,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  nextText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  restButtons: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  list: {
    gap: spacing.xs + 2,
  },
  listRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  listRowCurrent: {
    borderColor: colors.pink,
  },
  listName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    flexShrink: 1,
  },
  listNameDone: {
    color: colors.textMuted,
  },
  listCount: {
    fontSize: 14,
    fontWeight: "800",
  },
  endButton: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md - 2,
    alignItems: "center",
  },
  endConfirm: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  endText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
  },
});
