import { useRef, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "../theme";

const ROW_HEIGHT = 48;
const VISIBLE_ROWS = 6;

interface NumberPickerProps {
  label: string;
  value: number;
  options: number[];
  onChange: (value: number) => void;
  unit?: string;
  accent?: string;
  testID?: string;
}

// A tap-to-open scrolling list, so values are chosen from a fixed range instead of typed.
export function NumberPicker({
  label,
  value,
  options,
  onChange,
  unit,
  accent = colors.cyan,
  testID,
}: NumberPickerProps) {
  const [open, setOpen] = useState(false);
  const listRef = useRef<FlatList<number>>(null);
  const selectedIndex = Math.max(0, options.indexOf(value));

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ""}`}
        onPress={() => setOpen(true)}
        style={[styles.field, { borderColor: accent }]}
      >
        <Text style={styles.value} numberOfLines={1}>
          {value}
          {unit ? <Text style={styles.unit}> {unit}</Text> : null}
        </Text>
        <Text style={[styles.chevron, { color: accent }]}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={[styles.sheetTitle, { color: accent }]}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(n) => String(n)}
              style={{ height: Math.min(options.length, VISIBLE_ROWS) * ROW_HEIGHT }}
              getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
              ref={listRef}
              initialNumToRender={options.length}
              // Every row is rendered, then the list is scrolled so the current value is in view.
              onLayout={() =>
                listRef.current?.scrollToOffset({
                  offset: Math.max(0, selectedIndex - 2) * ROW_HEIGHT,
                  animated: false,
                })
              }
              showsVerticalScrollIndicator
              renderItem={({ item }) => {
                const selected = item === value;
                return (
                  <Pressable
                    testID={testID ? `${testID}-option-${item}` : undefined}
                    onPress={() => {
                      onChange(item);
                      setOpen(false);
                    }}
                    style={[styles.row, selected && { backgroundColor: accent }]}
                  >
                    <Text style={[styles.rowText, selected && { color: colors.background }]}>
                      {item}
                      {unit ? ` ${unit}` : ""}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    gap: 4,
  },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md - 4,
    height: 46,
  },
  value: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
    flexShrink: 1,
  },
  unit: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  chevron: {
    fontSize: 16,
    marginLeft: 4,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(6, 4, 20, 0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  sheet: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    overflow: "hidden",
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  row: {
    height: ROW_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  rowText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
});
