export const colors = {
  background: "#0d0a1f",
  surface: "#181235",
  surfaceAlt: "#231a4a",
  border: "#33286b",
  primary: "#8b5cf6",
  primaryText: "#ffffff",
  text: "#f6f3ff",
  textMuted: "#a99fd8",
  danger: "#ff5c7a",
  success: "#2ee6a6",
  pink: "#ff4d9d",
  orange: "#ff9f45",
  yellow: "#ffd23f",
  mint: "#2ee6a6",
  cyan: "#22d3ee",
  blue: "#5b8cff",
};

// Cycled through so cards, chips and charts each get their own color.
export const accents = [colors.pink, colors.cyan, colors.orange, colors.mint, colors.primary, colors.yellow, colors.blue];

export function accentFor(key: string | number): string {
  const n =
    typeof key === "number"
      ? key
      : Array.from(key.toLowerCase()).reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  return accents[n % accents.length];
}

export const gradients = {
  brand: [colors.primary, colors.pink] as const,
  warm: [colors.pink, colors.orange] as const,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
};
