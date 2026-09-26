import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAccount } from "../src/account/AccountContext";
import { ApiError } from "../src/api/client";
import { Button } from "../src/components/Button";
import { TextField } from "../src/components/TextField";
import { colors, radius, spacing } from "../src/theme";

type Mode = "signin" | "signup";

export default function AccountScreen() {
  const router = useRouter();
  const { signedIn, signIn, signUp } = useAccount();
  const [mode, setMode] = useState<Mode>("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const submitted = useRef(false);

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/settings");
  };

  // Already signed in (for example after a reload): nothing to do here.
  useEffect(() => {
    if (signedIn && !submitted.current) leave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  const submit = async () => {
    setError(null);
    const name = username.trim();
    if (mode === "signup") {
      if (name.length < 3) return setError("Username must be at least 3 characters.");
      if (!/^[a-zA-Z0-9_.]+$/.test(name)) return setError("Username may only contain letters, numbers, underscores, and periods.");
      if (password.length < 8) return setError("Password must be at least 8 characters.");
    }
    if (!name || !password) return setError("Enter your username and password.");

    submitted.current = true;
    setBusy(true);
    // The free-tier server can take a while to wake up on the first request.
    const timer = setTimeout(() => setSlow(true), 4000);
    try {
      if (mode === "signin") await signIn(name, password);
      else await signUp(name, password);
      leave();
    } catch (err) {
      submitted.current = false;
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      clearTimeout(timer);
      setSlow(false);
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{mode === "signin" ? "Sign in" : "Create account"}</Text>
        <Text style={styles.lead}>
          Your workouts always stay on this device. An account also backs them up and syncs them
          across your other devices. It's optional.
        </Text>

        <View style={styles.tabs}>
          {(["signin", "signup"] as const).map((m) => (
            <Pressable
              key={m}
              testID={`mode-${m}`}
              accessibilityRole="button"
              onPress={() => {
                setMode(m);
                setError(null);
              }}
              style={[styles.tab, mode === m && styles.tabActive]}
            >
              <Text style={[styles.tabText, mode === m && styles.tabTextActive]}>
                {m === "signin" ? "Sign in" : "Create account"}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextField
          label="Username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          placeholder={mode === "signup" ? "At least 3 characters" : "Your username"}
          testID="account-username"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
          testID="account-password"
          onSubmitEditing={submit}
        />

        {error ? (
          <Text style={styles.error} testID="account-error">
            {error}
          </Text>
        ) : null}
        {slow ? (
          <Text style={styles.slow} testID="account-slow">
            Waking up the server. The first request can take up to a minute…
          </Text>
        ) : null}

        <View testID="account-submit">
          <Button
            title={mode === "signin" ? "Sign in" : "Create account"}
            onPress={submit}
            loading={busy}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  lead: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    alignItems: "center",
    borderRadius: radius.sm,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    color: colors.textMuted,
    fontWeight: "700",
    fontSize: 14,
  },
  tabTextActive: {
    color: colors.primaryText,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "600",
  },
  slow: {
    color: colors.cyan,
    fontSize: 13,
  },
});
