import { Stack } from "expo-router";

import { AuthProvider } from "../src/auth/AuthContext";
import { WorkoutsProvider } from "../src/workouts/WorkoutsContext";

export default function RootLayout() {
  return (
    <AuthProvider>
      <WorkoutsProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="workout/[id]"
            options={{ headerShown: true, title: "Workout" }}
          />
        </Stack>
      </WorkoutsProvider>
    </AuthProvider>
  );
}
