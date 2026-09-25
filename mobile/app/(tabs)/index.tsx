import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "../../src/components/Button";
import { colors, spacing } from "../../src/theme";

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.emoji}>🔥</Text>
        <Text style={styles.title}>Ready to lift?</Text>
        <Text style={styles.subtitle}>
          Pick one of your saved sessions or start from scratch. Everything is saved on this device.
        </Text>
      </View>
      <View style={styles.footer}>
        <Button title="Start workout" onPress={() => router.push("/start")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  hero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  emoji: {
    fontSize: 56,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 21,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
