import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "../../src/components/Button";
import { TextField } from "../../src/components/TextField";
import { useSettings } from "../../src/settings/SettingsContext";
import { colors, radius, spacing } from "../../src/theme";

export default function SettingsScreen() {
  const { restTimerSeconds, setRestTimerSeconds } = useSettings();
  const [restSeconds, setRestSeconds] = useState(String(restTimerSeconds));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setRestSeconds(String(restTimerSeconds));
  }, [restTimerSeconds]);

  const onSave = async () => {
    const seconds = Number(restSeconds);
    setError(null);
    setSaved(false);
    if (!Number.isFinite(seconds) || seconds < 10 || seconds > 600) {
      setError("Enter a rest time between 10 and 600 seconds");
      return;
    }
    await setRestTimerSeconds(Math.round(seconds));
    setSaved(true);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.title}>Settings</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Default rest timer</Text>
          <Text style={styles.cardSubtitle}>
            Starts after each logged set. Saved on this device.
          </Text>
          <View style={styles.settingRow}>
            <TextField
              value={restSeconds}
              onChangeText={(text) => {
                setRestSeconds(text);
                setSaved(false);
              }}
              keyboardType="number-pad"
              style={styles.settingInput}
            />
            <Text style={styles.unit}>seconds</Text>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {saved ? <Text style={styles.success}>Saved</Text> : null}
          <Button title="Save" onPress={onSave} />
        </View>

        <View style={[styles.card, styles.noteCard]}>
          <Text style={styles.cardTitle}>Your data stays here</Text>
          <Text style={styles.cardSubtitle}>
            There are no accounts. Workouts and settings are stored on this device only, so
            clearing your browser data or uninstalling the app removes them.
          </Text>
        </View>
      </View>
    </View>
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
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "800",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 5,
    borderLeftColor: colors.orange,
    padding: spacing.md,
    gap: spacing.sm,
  },
  noteCard: {
    borderLeftColor: colors.cyan,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  cardSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  settingInput: {
    flex: 1,
  },
  unit: {
    color: colors.textMuted,
    fontSize: 14,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  success: {
    color: colors.success,
    fontSize: 13,
    fontWeight: "600",
  },
});
