import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";

import { useAccount } from "../account/AccountContext";
import { colors, spacing } from "../theme";

// Small status pill in the header: "Sign in" for guests, otherwise the current sync state.
export function SyncBadge() {
  const router = useRouter();
  const { signedIn, syncState, pendingCount } = useAccount();

  let label: string;
  let color: string;
  if (!signedIn) {
    label = syncState === "expired" ? "Sign in again" : "Sign in";
    color = syncState === "expired" ? colors.orange : colors.cyan;
  } else if (syncState === "syncing") {
    label = "Syncing…";
    color = colors.cyan;
  } else if (syncState === "offline") {
    label = "Offline";
    color = colors.orange;
  } else if (syncState === "error") {
    label = "Sync problem";
    color = colors.danger;
  } else if (pendingCount > 0) {
    label = "Saving…";
    color = colors.cyan;
  } else {
    label = "Synced";
    color = colors.mint;
  }

  return (
    <Pressable
      testID="sync-badge"
      accessibilityRole="button"
      accessibilityLabel={`Account: ${label}`}
      onPress={() => router.push(signedIn ? "/settings" : "/account")}
      style={[styles.pill, { borderColor: color }]}
    >
      <Text style={[styles.dot, { color }]}>●</Text>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: spacing.md,
  },
  dot: {
    fontSize: 9,
  },
  text: {
    fontSize: 12,
    fontWeight: "800",
  },
});
