import { Stack } from "expo-router";
import { StyleSheet, View } from "react-native";

import { Logo } from "../src/components/Logo";
import { SettingsProvider } from "../src/settings/SettingsContext";
import { colors } from "../src/theme";
import { WorkoutsProvider } from "../src/workouts/WorkoutsContext";

export default function RootLayout() {
  return (
    <SettingsProvider>
      <WorkoutsProvider>
        <View style={styles.page}>
          <View style={styles.frame}>
            <Stack
              screenOptions={{
                headerShown: false,
                headerStyle: { backgroundColor: colors.background },
                headerTintColor: colors.pink,
                headerTitleStyle: { color: colors.text, fontWeight: "700" },
                headerShadowVisible: false,
                contentStyle: { backgroundColor: colors.background },
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="workout/[id]"
                options={{
                  headerShown: true,
                  title: "Workout",
                  headerRight: () => (
                    <View style={styles.headerLogo}>
                      <Logo size={28} />
                    </View>
                  ),
                }}
              />
            </Stack>
          </View>
        </View>
      </WorkoutsProvider>
    </SettingsProvider>
  );
}

// On phones the frame fills the screen; on a desktop browser it becomes a centered column.
const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
  },
  frame: {
    flex: 1,
    width: "100%",
    maxWidth: 600,
  },
  headerLogo: {
    paddingRight: 8,
  },
});
