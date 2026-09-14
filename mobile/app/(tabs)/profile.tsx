import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ApiError } from "../../src/api/client";
import { useAuth } from "../../src/auth/AuthContext";
import { Button } from "../../src/components/Button";
import { TextField } from "../../src/components/TextField";
import { colors, radius, spacing } from "../../src/theme";

export default function ProfileScreen() {
  const { user, logout, updateRestTimerSeconds } = useAuth();
  const [restSeconds, setRestSeconds] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user) setRestSeconds(String(user.rest_timer_seconds));
  }, [user]);

  const onSave = async () => {
    const seconds = Number(restSeconds);
    setError(null);
    setSaved(false);
    if (!Number.isFinite(seconds) || seconds < 10 || seconds > 600) {
      setError("Enter a rest time between 10 and 600 seconds");
      return;
    }
    setSaving(true);
    try {
      await updateRestTimerSeconds(Math.round(seconds));
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.title}>Profile</Text>
        {user ? <Text style={styles.username}>@{user.username}</Text> : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Default rest timer</Text>
          <Text style={styles.cardSubtitle}>
            Saved to your account and used after logging a set.
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
          <Button title="Save" onPress={onSave} loading={saving} variant="secondary" />
        </View>

        <Button title="Log out" onPress={logout} variant="secondary" />
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
    fontSize: 24,
    fontWeight: "700",
  },
  username: {
    color: colors.textMuted,
    fontSize: 15,
    marginTop: -spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  cardSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
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
  },
});
