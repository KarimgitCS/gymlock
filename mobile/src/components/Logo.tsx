import { useId } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

import { colors, spacing } from "../theme";

// Also used to render the app icon and favicon (assets/logo.svg mirrors this drawing).
export function Logo({ size = 32 }: { size?: number }) {
  // Unique per instance: duplicate SVG ids break gradient references when one copy is hidden.
  const gradientId = `gl-bg-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.primary} />
          <Stop offset="1" stopColor={colors.pink} />
        </LinearGradient>
      </Defs>
      <Rect width="64" height="64" rx="15" fill={`url(#${gradientId})`} />
      <Rect x="9" y="24" width="5" height="16" rx="2.5" fill="#fff" />
      <Rect x="15" y="19" width="7" height="26" rx="3" fill="#fff" />
      <Rect x="22" y="29" width="20" height="6" rx="3" fill="#fff" />
      <Rect x="42" y="19" width="7" height="26" rx="3" fill="#fff" />
      <Rect x="50" y="24" width="5" height="16" rx="2.5" fill="#fff" />
      <Circle cx="32" cy="32" r="6.5" fill={colors.background} />
      <Path d="M32 28.6a2.4 2.4 0 0 1 1.1 4.5v2.4h-2.2v-2.4a2.4 2.4 0 0 1 1.1-4.5z" fill="#fff" />
    </Svg>
  );
}

export function BrandHeader() {
  return (
    <View style={styles.row}>
      <Logo size={30} />
      <Text style={styles.name}>
        Gym<Text style={styles.nameAccent}>Lock</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingLeft: spacing.md,
  },
  name: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  nameAccent: {
    color: colors.pink,
  },
});
