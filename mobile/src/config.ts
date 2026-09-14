// Set EXPO_PUBLIC_API_URL in mobile/.env to your machine's LAN IP, e.g.
// EXPO_PUBLIC_API_URL=http://192.168.1.42:8000
// (Your phone can't reach "localhost" since it's a separate device on the network.)
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";
