import { Stack } from "expo-router";
import { StyleSheet, View } from "react-native";

import { AuthProvider } from "../src/auth/AuthContext";
import { colors } from "../src/theme";
import { WorkoutsProvider } from "../src/workouts/WorkoutsContext";

export default function RootLayout() {
  return (
    <AuthProvider>
      <WorkoutsProvider>
        <View style={styles.page}>
          <View style={styles.frame}>
            <Stack
              screenOptions={{
                headerShown: false,
                headerStyle: { backgroundColor: colors.background },
                headerTintColor: colors.text,
                headerTitleStyle: { color: colors.text },
                headerShadowVisible: false,
                contentStyle: { backgroundColor: colors.background },
              }}
            >
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="workout/[id]"
                options={{ headerShown: true, title: "Workout" }}
              />
            </Stack>
          </View>
        </View>
      </WorkoutsProvider>
    </AuthProvider>
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
});
