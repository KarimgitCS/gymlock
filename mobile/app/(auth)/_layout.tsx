import { Redirect, Stack } from "expo-router";

import { useAuth } from "../../src/auth/AuthContext";

export default function AuthLayout() {
  const { token, isLoading } = useAuth();

  if (isLoading) return null;
  if (token) return <Redirect href="/(tabs)" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
