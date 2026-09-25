import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import { api, setUnauthorizedHandler } from "../api/client";
import type { User } from "../api/types";
import { tokenStorage } from "./tokenStorage";

const TOKEN_KEY = "gymlock_token";

interface AuthContextValue {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  signup: (username: string, password: string) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateRestTimerSeconds: (seconds: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    tokenStorage
      .get(TOKEN_KEY)
      .then(setToken)
      .finally(() => setIsLoading(false));
  }, []);

  // The token is the source of truth for the session; once it's known, load
  // the account's profile and persisted settings (e.g. rest timer duration)
  // so they're available on every device the user logs into, not just this one.
  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }
    api
      .getMe(token)
      .then(setUser)
      .catch(() => setUser(null));
  }, [token]);

  // An expired or unknown token means the session is over: clear it so the auth guard
  // sends the user back to the login screen instead of leaving a dead-looking app.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      tokenStorage.remove(TOKEN_KEY);
      setToken(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const persistToken = async (newToken: string) => {
    await tokenStorage.set(TOKEN_KEY, newToken);
    setToken(newToken);
  };

  const updateRestTimerSeconds = useCallback(
    async (seconds: number) => {
      if (!token) throw new Error("Not authenticated");
      const updated = await api.updateSettings(token, seconds);
      setUser(updated);
    },
    [token]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isLoading,
      signup: async (username, password) => {
        const result = await api.signup(username, password);
        await persistToken(result.access_token);
      },
      login: async (username, password) => {
        const result = await api.login(username, password);
        await persistToken(result.access_token);
      },
      logout: async () => {
        await tokenStorage.remove(TOKEN_KEY);
        setToken(null);
      },
      updateRestTimerSeconds,
    }),
    [token, user, isLoading, updateRestTimerSeconds]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
