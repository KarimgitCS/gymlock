import AsyncStorage from "@react-native-async-storage/async-storage";

// AsyncStorage persists on the device: localStorage in the browser, app storage on phones.
export async function loadJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function saveJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be full or blocked (private browsing); the app keeps working in memory.
  }
}
