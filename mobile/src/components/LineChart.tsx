import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";

import { colors, spacing } from "../theme";

interface Point {
  x: number;
  y: number;
}

interface LineChartProps {
  points: Point[];
  height?: number;
  formatY?: (y: number) => string;
}

const CHART_WIDTH = 320;

export function LineChart({ points, height = 180, formatY }: LineChartProps) {
  if (points.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>No data yet</Text>
      </View>
    );
  }

  const paddingX = 14;
  const paddingY = 18;

  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  const rangeY = maxY - minY || 1;

  const minX = points[0].x;
  const maxX = points[points.length - 1].x;
  const rangeX = maxX - minX || 1;

  const scaleX = (x: number) =>
    paddingX + ((x - minX) / rangeX) * (CHART_WIDTH - paddingX * 2);
  const scaleY = (y: number) =>
    height - paddingY - ((y - minY) / rangeY) * (height - paddingY * 2);

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(p.x).toFixed(1)} ${scaleY(p.y).toFixed(1)}`)
    .join(" ");

  const last = points[points.length - 1];

  return (
    <View>
      <Svg width="100%" height={height} viewBox={`0 0 ${CHART_WIDTH} ${height}`}>
        <Line
          x1={paddingX}
          y1={height - paddingY}
          x2={CHART_WIDTH - paddingX}
          y2={height - paddingY}
          stroke={colors.border}
          strokeWidth={1}
        />
        <Path d={pathD} stroke={colors.primary} strokeWidth={2} fill="none" />
        {points.map((p, i) => (
          <Circle key={i} cx={scaleX(p.x)} cy={scaleY(p.y)} r={3.5} fill={colors.primary} />
        ))}
      </Svg>
      <Text style={styles.footerText}>Latest: {formatY ? formatY(last.y) : last.y}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: spacing.xs,
  },
});
