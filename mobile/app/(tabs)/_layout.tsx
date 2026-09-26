import { Tabs } from "expo-router";
import { Text } from "react-native";

import { BrandHeader } from "../../src/components/Logo";
import { SyncBadge } from "../../src/components/SyncBadge";
import { colors } from "../../src/theme";

function TabIcon({ symbol, focused }: { symbol: string; focused: boolean }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>{symbol}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerLeft: () => <BrandHeader />,
        headerRight: () => <SyncBadge />,
        headerTitle: "",
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 72,
          paddingBottom: 12,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.pink,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontWeight: "700", fontSize: 11, lineHeight: 16 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Workouts",
          tabBarIcon: ({ focused }) => <TabIcon symbol="🏋️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: "Progress",
          tabBarIcon: ({ focused }) => <TabIcon symbol="📈" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ focused }) => <TabIcon symbol="⚙️" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
