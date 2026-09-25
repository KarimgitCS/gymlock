import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Button } from "../../src/components/Button";
import { NumberPicker } from "../../src/components/NumberPicker";
import { TextField } from "../../src/components/TextField";
import {
  DEFAULT_REPS,
  DEFAULT_SETS,
  DEFAULT_WEIGHT,
  REPS_OPTIONS,
  SETS_OPTIONS,
  WEIGHT_OPTIONS,
} from "../../src/constants";
import { usePresets } from "../../src/presets/PresetsContext";
import { accentFor, colors, radius, spacing } from "../../src/theme";

interface DraftExercise {
  key: number;
  name: string;
  sets: number;
  reps: number;
  weight: number;
}

export default function PresetEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";
  const presetId = isNew ? undefined : Number(id);
  const router = useRouter();
  const { getPreset, isLoading, savePreset, deletePreset } = usePresets();
  const existing = presetId !== undefined ? getPreset(presetId) : undefined;

  const nextKey = useRef(1);
  const blankExercise = (): DraftExercise => ({
    key: nextKey.current++,
    name: "",
    sets: DEFAULT_SETS,
    reps: DEFAULT_REPS,
    weight: DEFAULT_WEIGHT,
  });

  const [name, setName] = useState("");
  const [exercises, setExercises] = useState<DraftExercise[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (loaded || isLoading) return;
    if (isNew) {
      setExercises([blankExercise()]);
      setLoaded(true);
    } else if (existing) {
      setName(existing.name);
      setExercises(existing.exercises.map((e) => ({ ...e, key: nextKey.current++ })));
      setLoaded(true);
    }
    // blankExercise only touches a ref, so it is safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isNew, existing, loaded]);

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/start");
  };

  const update = (key: number, patch: Partial<DraftExercise>) =>
    setExercises((prev) => prev.map((e) => (e.key === key ? { ...e, ...patch } : e)));

  const onSave = async () => {
    setError(null);
    if (!name.trim()) return setError("Give the preset a name, like Push Day.");
    if (exercises.length === 0) return setError("Add at least one exercise.");
    if (exercises.some((e) => !e.name.trim())) return setError("Every exercise needs a name.");
    await savePreset({
      id: presetId,
      name,
      exercises: exercises.map(({ name: n, sets, reps, weight }) => ({ name: n, sets, reps, weight })),
    });
    leave();
  };

  const onDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    if (presetId !== undefined) await deletePreset(presetId);
    leave();
  };

  if (!isNew && !isLoading && !existing && !loaded) {
    return (
      <View style={styles.screen}>
        <Text style={styles.missing}>This preset no longer exists.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ title: isNew ? "New preset" : "Edit preset" }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextField
          label="Preset name"
          placeholder="e.g. Push Day"
          value={name}
          onChangeText={setName}
          testID="preset-name"
        />

        {exercises.map((exercise, index) => (
          <View
            key={exercise.key}
            style={[styles.exerciseCard, { borderLeftColor: accentFor(index) }]}
          >
            <View style={styles.exerciseHeader}>
              <Text style={[styles.exerciseIndex, { color: accentFor(index) }]}>
                Exercise {index + 1}
              </Text>
              <Pressable
                testID={`ex-${index}-remove`}
                accessibilityRole="button"
                accessibilityLabel={`Remove exercise ${index + 1}`}
                onPress={() => setExercises((prev) => prev.filter((e) => e.key !== exercise.key))}
              >
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            </View>
            <TextField
              placeholder="Exercise name (e.g. Bench Press)"
              value={exercise.name}
              onChangeText={(text) => update(exercise.key, { name: text })}
              testID={`ex-${index}-name`}
            />
            <View style={styles.pickerRow}>
              <NumberPicker
                label="Sets"
                value={exercise.sets}
                options={SETS_OPTIONS}
                onChange={(v) => update(exercise.key, { sets: v })}
                accent={colors.pink}
                testID={`ex-${index}-sets`}
              />
              <NumberPicker
                label="Reps"
                value={exercise.reps}
                options={REPS_OPTIONS}
                onChange={(v) => update(exercise.key, { reps: v })}
                accent={colors.cyan}
                testID={`ex-${index}-reps`}
              />
              <NumberPicker
                label="Weight"
                value={exercise.weight}
                options={WEIGHT_OPTIONS}
                unit="lb"
                onChange={(v) => update(exercise.key, { weight: v })}
                accent={colors.orange}
                testID={`ex-${index}-weight`}
              />
            </View>
          </View>
        ))}

        <Button
          title="+ Add exercise"
          variant="secondary"
          onPress={() => setExercises((prev) => [...prev, blankExercise()])}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button title="Save preset" onPress={onSave} />

        {isNew ? null : (
          <Pressable
            testID="preset-delete"
            accessibilityRole="button"
            onPress={onDelete}
            style={[styles.deleteButton, confirmDelete && styles.deleteConfirm]}
          >
            <Text style={[styles.deleteText, confirmDelete && { color: colors.background }]}>
              {confirmDelete ? "Tap again to delete this preset" : "Delete preset"}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  missing: {
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.xl,
  },
  exerciseCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 5,
    padding: spacing.md,
    gap: spacing.sm + 2,
  },
  exerciseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  exerciseIndex: {
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  remove: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "700",
  },
  pickerRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "600",
  },
  deleteButton: {
    borderWidth: 1.5,
    borderColor: colors.danger,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  deleteConfirm: {
    backgroundColor: colors.danger,
  },
  deleteText: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: "700",
  },
});
