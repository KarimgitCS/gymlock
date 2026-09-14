import { StyleSheet, Text, View } from "react-native";

import { useAuth } from "../../src/auth/AuthContext";
import { Button } from "../../src/components/Button";
import { colors, spacing } from "../../src/theme";

export default function ProfileScreen() {
  const { logout } = useAuth();

  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.title}>Profile</Text>
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
});
