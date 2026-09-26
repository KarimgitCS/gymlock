import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAccount } from "../../src/account/AccountContext";

import { Button } from "../../src/components/Button";
import { TextField } from "../../src/components/TextField";
import { useSettings } from "../../src/settings/SettingsContext";
import { colors, radius, spacing } from "../../src/theme";

function timeAgo(ms: number | null): string {
  if (!ms) return "never";
  const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes} min ago` : `${Math.round(minutes / 60)} h ago`;
}

function AccountCard() {
  const router = useRouter();
  const { signedIn, username, syncState, syncError, lastSyncedAt, pendingCount, syncNow, signOut } = useAccount();
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [busy, setBusy] = useState(false);

  const status =
    syncState === "syncing"
      ? { color: colors.cyan, text: "Syncing…" }
      : syncState === "offline"
        ? { color: colors.orange, text: `Offline. ${pendingCount} change${pendingCount === 1 ? "" : "s"} will sync when you're back online.` }
        : syncState === "error"
          ? { color: colors.danger, text: syncError ?? "Sync failed. Retrying automatically." }
          : pendingCount > 0
            ? { color: colors.cyan, text: `${pendingCount} change${pendingCount === 1 ? "" : "s"} waiting to sync` }
            : { color: colors.mint, text: `Synced ${timeAgo(lastSyncedAt)}` };

  const unsynced = pendingCount > 0 || syncState === "offline" || syncState === "error";

  if (!signedIn) {
    return (
      <View style={[styles.card, styles.accountCard]} testID="account-card">
        <Text style={styles.cardTitle}>
          {syncState === "expired" ? "Session expired" : "Sync across devices"}
        </Text>
        <Text style={styles.cardSubtitle}>
          {syncState === "expired"
            ? "Your workouts are still on this device. Sign in again to resume syncing."
            : "Your data lives on this device. Sign in to back it up and use it on your other devices. It's optional."}
        </Text>
        <View testID="open-account">
          <Button
            title={syncState === "expired" ? "Sign in again" : "Sign in or create account"}
            onPress={() => router.push("/account")}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, styles.accountCard]} testID="account-card">
      <Text style={styles.cardTitle}>Signed in as @{username}</Text>
      <View style={styles.statusRow}>
        <Text style={[styles.statusDot, { color: status.color }]}>●</Text>
        <Text style={styles.statusText} testID="sync-status">
          {status.text}
        </Text>
      </View>
      <View style={styles.accountButtons}>
        <View style={{ flex: 1 }} testID="sync-now">
          <Button title="Sync now" variant="secondary" onPress={() => void syncNow()} loading={syncState === "syncing"} />
        </View>
        <View style={{ flex: 1 }} testID="sign-out">
          <Button
            title={confirmingSignOut ? "Tap again to sign out" : "Sign out"}
            variant="secondary"
            loading={busy}
            onPress={async () => {
              if (!confirmingSignOut) return setConfirmingSignOut(true);
              setBusy(true);
              await signOut();
              setBusy(false);
              setConfirmingSignOut(false);
            }}
          />
        </View>
      </View>
      {confirmingSignOut ? (
        <Text style={styles.warning} testID="sign-out-warning">
          Signing out removes your workouts from this device. They stay in your account.
          {unsynced ? " Some recent changes have not synced yet and may be lost." : ""}
        </Text>
      ) : null}
    </View>
  );
}

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
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Settings</Text>

        <AccountCard />

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Default rest timer</Text>
          <Text style={styles.cardSubtitle}>
            Starts after each set you mark done. Saved on this device and synced to your account when you are signed in.
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
          <Text style={styles.cardTitle}>Where your data lives</Text>
          <Text style={styles.cardSubtitle}>
            Workouts, sessions and settings are always saved on this device first, so the app works
            without a connection. Without an account, clearing your browser data or uninstalling the
            app removes them.
          </Text>
        </View>
      </ScrollView>
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
  accountCard: {
    borderLeftColor: colors.pink,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  statusDot: {
    fontSize: 11,
  },
  statusText: {
    color: colors.text,
    fontSize: 14,
    flexShrink: 1,
  },
  accountButtons: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  warning: {
    color: colors.orange,
    fontSize: 13,
    lineHeight: 18,
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
