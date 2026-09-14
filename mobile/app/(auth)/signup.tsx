import { Link, useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ApiError } from "../../src/api/client";
import { useAuth } from "../../src/auth/AuthContext";
import { Button } from "../../src/components/Button";
import { TextField } from "../../src/components/TextField";
import { colors, spacing } from "../../src/theme";

export default function SignupScreen() {
  const { signup } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (username.trim().length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }
    if (!/^[a-zA-Z0-9_.]+$/.test(username.trim())) {
      setError("Username may only contain letters, numbers, underscores, and periods");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      await signup(username.trim(), password);
      router.replace("/(tabs)");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Start tracking your workouts</Text>

        <View style={styles.form}>
          <TextField
            label="Username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username-new"
            placeholder="At least 3 characters"
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password-new"
            placeholder="At least 8 characters"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            title="Sign up"
            onPress={onSubmit}
            loading={loading}
            disabled={!username || !password}
          />
        </View>

        <Link href="/(auth)/login" style={styles.link}>
          <Text style={styles.linkText}>
            Already have an account? <Text style={styles.linkAccent}>Log in</Text>
          </Text>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: -spacing.md,
  },
  form: {
    gap: spacing.md,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
  },
  link: {
    alignSelf: "center",
  },
  linkText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  linkAccent: {
    color: colors.primary,
    fontWeight: "600",
  },
});
