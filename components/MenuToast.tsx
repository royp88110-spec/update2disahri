/**
 * Compact daily menu notification.
 *
 * Only translate and opacity are animated with the native driver so the
 * notification stays smooth on both 60 Hz and high-refresh-rate devices.
 */

import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const AUTO_DISMISS_MS = 4500;
const ENTRY_OFFSET = -140;

export interface DailyMenuMeal {
  label: "Breakfast" | "Lunch" | "Dinner";
  items: string;
}

export interface MenuToastData {
  id: string;
  dayName: string;
  meals: DailyMenuMeal[];
  unavailable: boolean;
}

interface Props {
  toast: MenuToastData;
  onDismiss: () => void;
}

export function MenuToast({ toast, onDismiss }: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(ENTRY_OFFSET)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dismissedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: ENTRY_OFFSET,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onDismiss();
    });
  }, [onDismiss, opacity, translateY]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    timerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [dismiss, opacity, translateY]);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        {
          top: insets.top + 8,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.card}>
        <View style={styles.accentBar} />
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Text style={styles.icon}>🍽️</Text>
            </View>
            <Text style={styles.dayName}>{toast.dayName}</Text>
            <Text style={styles.headerLabel}>TODAY'S MENU</Text>
            <Pressable onPress={dismiss} hitSlop={12} style={styles.closeButton}>
              <Feather name="x" size={13} color="#64748B" />
            </Pressable>
          </View>

          {toast.unavailable ? (
            <Text style={styles.unavailable}>Today's menu is not available.</Text>
          ) : (
            <View style={styles.meals}>
              {toast.meals.map((meal) => (
                <View key={meal.label} style={styles.mealRow}>
                  <Text style={styles.mealLabel}>{meal.label}</Text>
                  <Text style={styles.mealItems} numberOfLines={1}>
                    {meal.items}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 9999,
    shadowColor: "#0F766E",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 14,
  },
  card: {
    flexDirection: "row",
    overflow: "hidden",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(13,148,136,0.22)",
    backgroundColor: "#F0FDFA",
  },
  accentBar: {
    width: 3,
    backgroundColor: "#0D9488",
  },
  content: {
    flex: 1,
    paddingHorizontal: 11,
    paddingVertical: 9,
    gap: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  iconWrap: {
    width: 25,
    height: 25,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#CCFBF1",
  },
  icon: { fontSize: 14 },
  dayName: {
    color: "#134E4A",
    fontSize: 14,
    fontWeight: "800",
  },
  headerLabel: {
    flex: 1,
    color: "#0F766E",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  closeButton: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: "rgba(15,118,110,0.08)",
  },
  meals: { gap: 3 },
  mealRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mealLabel: {
    width: 62,
    color: "#0F766E",
    fontSize: 11,
    fontWeight: "700",
  },
  mealItems: {
    flex: 1,
    color: "#334155",
    fontSize: 11,
  },
  unavailable: {
    color: "#475569",
    fontSize: 12,
    fontStyle: "italic",
  },
});