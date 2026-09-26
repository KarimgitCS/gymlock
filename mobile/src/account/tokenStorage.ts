import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const KEY = "gymlock_token";

// Native: the OS keychain/keystore. Web has no secure store, so it uses localStorage.
export const tokenStorage = {
  async get(): Promise<string | null> {
    if (Platform.OS === "web") return window.localStorage.getItem(KEY);
    return SecureStore.getItemAsync(KEY);
  },
  async set(value: string): Promise<void> {
    if (Platform.OS === "web") return window.localStorage.setItem(KEY, value);
    await SecureStore.setItemAsync(KEY, value);
  },
  async clear(): Promise<void> {
    if (Platform.OS === "web") return window.localStorage.removeItem(KEY);
    await SecureStore.deleteItemAsync(KEY);
  },
};
