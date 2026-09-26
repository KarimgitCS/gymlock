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
import { TextField } from "../../src/components/TextField";
import { DEFAULT_REPS, DEFAULT_SETS, DEFAULT_WEIGHT } from "../../src/constants";
import { usePresets } from "../../src/presets/PresetsContext";
import { colors, radius, spacing } from "../../src/theme";
import { ExercisePlanEditor } from "../../src/workout/ExercisePlanEditor";

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
  const presetId = isNew ? undefined : id;
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
          <ExercisePlanEditor
            key={exercise.key}
            index={index}
            values={exercise}
            onChange={(patch) => update(exercise.key, patch)}
            onRemove={() => setExercises((prev) => prev.filter((e) => e.key !== exercise.key))}
          />
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
