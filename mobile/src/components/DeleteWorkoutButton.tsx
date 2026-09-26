import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { colors, radius, spacing } from "../theme";

interface Props {
  onDelete: () => void;
  testID?: string;
  compact?: boolean;
}

// Needs a second tap to confirm, and falls back to the first state if left alone.
export function DeleteWorkoutButton({ onDelete, testID, compact }: Props) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(timer);
  }, [confirming]);

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={() => (confirming ? onDelete() : setConfirming(true))}
      style={[styles.button, compact && styles.compact, confirming && styles.confirming]}
    >
      <Text style={[styles.text, confirming && styles.confirmingText]}>
        {confirming ? "Tap again to delete" : "Delete"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1.5,
    borderColor: colors.danger,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
  },
  compact: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
  },
  confirming: {
    backgroundColor: colors.danger,
  },
  text: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "800",
  },
  confirmingText: {
    color: colors.background,
  },
});
