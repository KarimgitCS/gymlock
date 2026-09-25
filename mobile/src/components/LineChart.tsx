import { useId } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from "react-native-svg";

import { colors, spacing } from "../theme";

interface Point {
  x: number;
  y: number;
}

interface LineChartProps {
  points: Point[];
  color?: string;
  height?: number;
  formatY?: (y: number) => string;
}

const CHART_WIDTH = 320;

export function LineChart({ points, color = colors.pink, height = 180, formatY }: LineChartProps) {
  const areaId = `area-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  if (points.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>No data yet</Text>
      </View>
    );
  }

  const paddingX = 14;
  const paddingY = 18;
  const baseline = height - paddingY;

  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  const rangeY = maxY - minY || 1;

  const minX = points[0].x;
  const maxX = points[points.length - 1].x;
  const rangeX = maxX - minX || 1;

  const scaleX = (x: number) => paddingX + ((x - minX) / rangeX) * (CHART_WIDTH - paddingX * 2);
  const scaleY = (y: number) => baseline - ((y - minY) / rangeY) * (height - paddingY * 2);

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(p.x).toFixed(1)} ${scaleY(p.y).toFixed(1)}`)
    .join(" ");
  const first = points[0];
  const last = points[points.length - 1];
  const areaPath = `${linePath} L ${scaleX(last.x).toFixed(1)} ${baseline} L ${scaleX(first.x).toFixed(1)} ${baseline} Z`;

  return (
    <View>
      <Svg width="100%" height={height} viewBox={`0 0 ${CHART_WIDTH} ${height}`}>
        <Defs>
          <LinearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.4" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <Line
            key={f}
            x1={paddingX}
            x2={CHART_WIDTH - paddingX}
            y1={baseline - f * (height - paddingY * 2)}
            y2={baseline - f * (height - paddingY * 2)}
            stroke={colors.border}
            strokeWidth={1}
            strokeDasharray="3 5"
          />
        ))}
        <Line
          x1={paddingX}
          y1={baseline}
          x2={CHART_WIDTH - paddingX}
          y2={baseline}
          stroke={colors.border}
          strokeWidth={1}
        />
        {points.length > 1 ? <Path d={areaPath} fill={`url(#${areaId})`} /> : null}
        <Path d={linePath} stroke={color} strokeWidth={3} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <Circle
            key={i}
            cx={scaleX(p.x)}
            cy={scaleY(p.y)}
            r={5}
            fill={colors.background}
            stroke={color}
            strokeWidth={3}
          />
        ))}
      </Svg>
      <Text style={[styles.footerText, { color }]}>
        Latest: {formatY ? formatY(last.y) : last.y}
      </Text>
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
    fontSize: 13,
    fontWeight: "700",
    marginTop: spacing.xs,
  },
});
