import { Link, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../../src/theme";
import { ActiveWorkout } from "../../src/workout/ActiveWorkout";
import { WorkoutSetup } from "../../src/workout/WorkoutSetup";
import { WorkoutSummary } from "../../src/workout/WorkoutSummary";
import { useWorkouts } from "../../src/workouts/WorkoutsContext";

// A workout moves through three stages: planned (set everything up), active (do the sets), done.
export default function WorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getWorkout, isLoading } = useWorkouts();
  const workout = getWorkout(id);

  if (!workout) {
    return (
      <View style={styles.screen}>
        <Text style={styles.empty}>{isLoading ? "Loading workout…" : "Workout not found"}</Text>
        {isLoading ? null : (
          <Link href="/" style={styles.link}>
            ‹ Back to home
          </Link>
        )}
      </View>
    );
  }

  const status = workout.status ?? "done";
  const title =
    status === "planned" ? "Set up workout" : status === "active" ? workout.name || "Workout" : "Summary";

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen
        options={{
          title,
          // After a browser reload there is no history to go back to, so offer a link home.
          headerLeft: router.canGoBack()
            ? undefined
            : () => (
                <Link href="/" style={styles.backLink}>
                  ‹ Home
                </Link>
              ),
        }}
      />
      {status === "planned" ? (
        <WorkoutSetup workout={workout} />
      ) : status === "active" ? (
        <ActiveWorkout workout={workout} />
      ) : (
        <WorkoutSummary workout={workout} />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    marginTop: spacing.lg,
  },
  link: {
    color: colors.pink,
    fontSize: 16,
    textAlign: "center",
    marginTop: spacing.md,
  },
  backLink: {
    color: colors.pink,
    fontSize: 16,
    fontWeight: "700",
    paddingHorizontal: spacing.sm,
  },
});
