import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "../../src/components/Button";
import { colors, radius, spacing } from "../../src/theme";
import { getWorkoutProgress } from "../../src/utils/workoutProgress";
import { useWorkouts } from "../../src/workouts/WorkoutsContext";

export default function HomeScreen() {
  const router = useRouter();
  const { openWorkout } = useWorkouts();
  const progress = openWorkout ? getWorkoutProgress(openWorkout) : null;
  const isActive = openWorkout?.status === "active";

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.emoji}>🔥</Text>
        <Text style={styles.title}>Ready to lift?</Text>
        <Text style={styles.subtitle}>
          Pick one of your saved sessions or start from scratch. Everything is saved on this device.
        </Text>

        {openWorkout && progress ? (
          <Pressable
            testID="resume-workout"
            accessibilityRole="button"
            onPress={() => router.push(`/workout/${openWorkout.id}`)}
            style={styles.resume}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.resumeKicker}>{isActive ? "Workout in progress" : "Workout being set up"}</Text>
              <Text style={styles.resumeName}>{openWorkout.name || "Workout"}</Text>
              <Text style={styles.resumeMeta}>
                {isActive
                  ? `${progress.doneSets}/${progress.totalSets} sets done`
                  : `${openWorkout.exercises.length} exercise${openWorkout.exercises.length === 1 ? "" : "s"} planned`}
              </Text>
            </View>
            <Text style={styles.resumeGo}>Resume ›</Text>
          </Pressable>
        ) : null}
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
  resume: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.mint,
    padding: spacing.md,
  },
  resumeKicker: {
    color: colors.mint,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  resumeName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 2,
  },
  resumeMeta: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  resumeGo: {
    color: colors.mint,
    fontSize: 15,
    fontWeight: "800",
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
