import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PRIMARY, ORANGE } from "@/constants/colors";
import { useData } from "@/context/DataContext";

const INACTIVE = "#9CA3AF";

function TabIcon({
  name,
  color,
  focused,
}: {
  name: React.ComponentProps<typeof Feather>["name"];
  color: string;
  focused: boolean;
}) {
  return (
    <View style={styles.iconWrap}>
      {focused && <View style={styles.activeDot} />}
      <Feather name={name} size={22} color={color} />
    </View>
  );
}

function usePendingCount() {
  try {
    const { paymentSubmissions } = useData();
    return paymentSubmissions.filter((s) => s.status === "pending").length;
  } catch {
    return 0;
  }
}

export default function AdminLayout() {
  const insets = useSafeAreaInsets();
  const pendingCount = usePendingCount();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const TAB_HEIGHT = 68;
  const tabBottom = isIOS
    ? Math.max(insets.bottom, 16)
    : 16;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: PRIMARY,
        tabBarInactiveTintColor: INACTIVE,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          left: 12,
          right: 12,
          bottom: tabBottom,
          height: TAB_HEIGHT,
          borderRadius: 28,
          backgroundColor: isIOS ? "transparent" : "rgba(255,255,255,0.94)",
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.65)",
          elevation: 24,
          shadowColor: "#4F46E5",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.18,
          shadowRadius: 24,
          paddingTop: 6,
          paddingBottom: isWeb ? 14 : 8,
        },
        tabBarItemStyle: { paddingVertical: 0 },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "700",
          marginTop: 2,
        },
        tabBarBackground: isIOS
          ? () => (
              <BlurView
                intensity={90}
                tint="light"
                style={[StyleSheet.absoluteFill, { borderRadius: 28 }]}
              />
            )
          : undefined,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarLabel: "Home",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="home" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="members"
        options={{
          title: "Members",
          tabBarLabel: "Members",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="users" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: "Payments",
          tabBarLabel: "Payments",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="credit-card" color={color} focused={focused} />
          ),
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: ORANGE,
            fontSize: 9,
            minWidth: 16,
            height: 16,
            lineHeight: 16,
          },
        }}
      />
      <Tabs.Screen
        name="meals"
        options={{
          title: "Meals",
          tabBarLabel: "Meals",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="grid" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: "Menu",
          tabBarLabel: "Menu",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="book-open" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: "Expenses",
          tabBarLabel: "Expenses",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="dollar-sign" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarLabel: "More",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="more-horizontal" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  activeDot: {
    position: "absolute",
    top: -6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: PRIMARY,
  },
});
