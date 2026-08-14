import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PRIMARY, EMERALD, ORANGE } from "@/constants/colors";
import { useData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { AnnouncementToast } from "@/components/AnnouncementToast";
import { MenuToast } from "@/components/MenuToast";
import { useAnnouncementNotifications } from "@/hooks/useAnnouncementNotifications";
import { useMenuNotifications } from "@/hooks/useMenuNotifications";

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

function useNewNoticeCount() {
  try {
    const { announcements } = useData();
    return announcements.filter(
      (a) => Date.now() - new Date(a.createdAt).getTime() < 48 * 3_600_000,
    ).length;
  } catch {
    return 0;
  }
}

function usePendingPaymentCount() {
  try {
    const { paymentSubmissions } = useData();
    const { user } = useAuth();
    const memberId = user?.memberId ?? "";
    return paymentSubmissions.filter(
      (s) => s.memberId === memberId && s.status === "pending",
    ).length;
  } catch {
    return 0;
  }
}

export default function MemberLayout() {
  const insets = useSafeAreaInsets();
  const newNotices = useNewNoticeCount();
  const pendingPayments = usePendingPaymentCount();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const TAB_HEIGHT = 68;
  const tabBottom = isIOS ? Math.max(insets.bottom, 16) : 16;

  const { current, onDismiss } = useAnnouncementNotifications();
  const { current: menuToast, onDismiss: onMenuToastDismiss } = useMenuNotifications();

  return (
    <View style={{ flex: 1 }}>
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
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700", marginTop: 2 },
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
          title: "My Bill",
          tabBarLabel: "Home",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="home" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: "Payments",
          tabBarLabel: "Pay",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="credit-card" color={color} focused={focused} />
          ),
          tabBarBadge: pendingPayments > 0 ? pendingPayments : undefined,
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
          title: "My Meals",
          tabBarLabel: "Meals",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="calendar" color={color} focused={focused} />
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
            <TabIcon name="bar-chart-2" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="fines"
        options={{
          title: "Fines",
          tabBarLabel: "Fines",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="alert-circle" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="notices"
        options={{
          title: "Notices",
          tabBarLabel: "Notices",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="bell" color={color} focused={focused} />
          ),
          tabBarBadge: newNotices > 0 ? newNotices : undefined,
          tabBarBadgeStyle: {
            backgroundColor: EMERALD,
            fontSize: 9,
            minWidth: 16,
            height: 16,
            lineHeight: 16,
          },
        }}
      />
      {/* Hidden tabs (accessible via programmatic navigation) */}
      <Tabs.Screen
        name="advances"
        options={{
          href: null,
        }}
      />
    </Tabs>

      {/* ── Announcement slide-in toast overlay ─────────────────────────── */}
      {current && (
        <AnnouncementToast
          key={current.id}
          announcement={current}
          onDismiss={onDismiss}
        />
      )}
      {/* ── Menu update toast overlay ─────────────────────────────────── */}
      {menuToast && (
        <MenuToast
          key={menuToast.id}
          toast={menuToast}
          onDismiss={onMenuToastDismiss}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  iconWrap: { alignItems: "center", justifyContent: "center", position: "relative" },
  activeDot: {
    position: "absolute",
    top: -6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: PRIMARY,
  },
});
