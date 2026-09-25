import { Pressable, StyleSheet, Text, View } from "react-native";

import { NumberPicker } from "../components/NumberPicker";
import { TextField } from "../components/TextField";
import { REPS_OPTIONS, SETS_OPTIONS, WEIGHT_OPTIONS } from "../constants";
import { accentFor, colors, radius, spacing } from "../theme";

export interface PlanValues {
  name: string;
  sets: number;
  reps: number;
  weight: number;
}

// One exercise's name plus its sets, reps and weight, chosen from dropdowns. Shared by the preset
// editor and the workout setup screen so both behave identically.
export function ExercisePlanEditor({
  index,
  values,
  onChange,
  onRemove,
}: {
  index: number;
  values: PlanValues;
  onChange: (patch: Partial<PlanValues>) => void;
  onRemove: () => void;
}) {
  const accent = accentFor(index);
  return (
    <View style={[styles.card, { borderLeftColor: accent }]}>
      <View style={styles.header}>
        <Text style={[styles.index, { color: accent }]}>Exercise {index + 1}</Text>
        <Pressable
          testID={`ex-${index}-remove`}
          accessibilityRole="button"
          accessibilityLabel={`Remove exercise ${index + 1}`}
          onPress={onRemove}
        >
          <Text style={styles.remove}>Remove</Text>
        </Pressable>
      </View>
      <TextField
        placeholder="Exercise name (e.g. Bench Press)"
        value={values.name}
        onChangeText={(name) => onChange({ name })}
        testID={`ex-${index}-name`}
      />
      <View style={styles.pickers}>
        <NumberPicker
          label="Sets"
          value={values.sets}
          options={SETS_OPTIONS}
          onChange={(sets) => onChange({ sets })}
          accent={colors.pink}
          testID={`ex-${index}-sets`}
        />
        <NumberPicker
          label="Reps"
          value={values.reps}
          options={REPS_OPTIONS}
          onChange={(reps) => onChange({ reps })}
          accent={colors.cyan}
          testID={`ex-${index}-reps`}
        />
        <NumberPicker
          label="Weight"
          value={values.weight}
          options={WEIGHT_OPTIONS}
          unit="lb"
          onChange={(weight) => onChange({ weight })}
          accent={colors.orange}
          testID={`ex-${index}-weight`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 5,
    padding: spacing.md,
    gap: spacing.sm + 2,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  index: {
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
  pickers: {
    flexDirection: "row",
    gap: spacing.sm,
  },
});
