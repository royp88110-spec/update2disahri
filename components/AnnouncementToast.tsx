/**
 * AnnouncementToast — compact pill notification banner
 *
 * ~48px tall, slide-down + fade entrance, fade-out exit.
 * Two themes: general (indigo) · payment_reminder (amber)
 */

import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
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

import type { Announcement } from "@/context/DataContext";

// ─── Constants ────────────────────────────────────────────────────────────────

const H_MARGIN        = 12;
const AUTO_DISMISS_MS = 5000;
// Offset above screen used for entrance/exit animation
const ENTRY_OFFSET    = -90;

// ─── Theme ────────────────────────────────────────────────────────────────────

interface Theme {
  accentGrad:     readonly [string, string];
  cardBg:         string;
  cardBorder:     string;
  shadowColor:    string;
  iconBg:         string;
  iconBorder:     string;
  iconColor:      string;
  iconFamily:     "ionicons" | "feather";
  iconName:       string;
  titleColor:     string;
  subtitleColor:  string;
  badgeBg:        string;
  badgeText:      string;
  badgeTextColor: string;
  closeBg:        string;
  closeBorder:    string;
  closeIconColor: string;
  progressBg:     string;
  progressFg:     string;
}

function getTheme(type: Announcement["type"]): Theme {
  if (type === "payment_reminder") {
    return {
      accentGrad:     ["#F59E0B", "#D97706"],
      cardBg:         "#FFFBEB",
      cardBorder:     "#FDE68A",
      shadowColor:    "#92400E",
      iconBg:         "#FFF7ED",
      iconBorder:     "#FCD34D",
      iconColor:      "#D97706",
      iconFamily:     "feather",
      iconName:       "bell",
      titleColor:     "#1C1917",
      subtitleColor:  "#78716C",
      badgeBg:        "#F59E0B",
      badgeText:      "DUE",
      badgeTextColor: "#fff",
      closeBg:        "rgba(0,0,0,0.05)",
      closeBorder:    "rgba(0,0,0,0.08)",
      closeIconColor: "#78716C",
      progressBg:     "#FEF3C7",
      progressFg:     "#F59E0B",
    };
  }
  return {
    accentGrad:     ["#4F46E5", "#7C3AED"],
    cardBg:         "#FFFFFF",
    cardBorder:     "rgba(79,70,229,0.15)",
    shadowColor:    "#4F46E5",
    iconBg:         "#EDE9FE",
    iconBorder:     "#C4B5FD",
    iconColor:      "#4F46E5",
    iconFamily:     "ionicons",
    iconName:       "megaphone",
    titleColor:     "#1E1B4B",
    subtitleColor:  "#6B7280",
    badgeBg:        "#4F46E5",
    badgeText:      "NEW",
    badgeTextColor: "#fff",
    closeBg:        "rgba(0,0,0,0.05)",
    closeBorder:    "rgba(0,0,0,0.08)",
    closeIconColor: "#6B7280",
    progressBg:     "#EDE9FE",
    progressFg:     "#4F46E5",
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isNew(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < 48 * 3_600_000;
}

function ToastIcon({ theme }: { theme: Theme }) {
  if (theme.iconFamily === "ionicons") {
    return (
      <Ionicons
        name={theme.iconName as React.ComponentProps<typeof Ionicons>["name"]}
        size={16}
        color={theme.iconColor}
      />
    );
  }
  return (
    <Feather
      name={theme.iconName as React.ComponentProps<typeof Feather>["name"]}
      size={15}
      color={theme.iconColor}
    />
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  announcement: Announcement;
  onDismiss:    () => void;
}

export function AnnouncementToast({ announcement, onDismiss }: Props) {
  const insets = useSafeAreaInsets();
  const theme  = getTheme(announcement.type);

  // Animation values
  const translateY = useRef(new Animated.Value(ENTRY_OFFSET)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const progress   = useRef(new Animated.Value(1)).current;

  const dismissedRef = useRef(false);
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressAnim = useRef<Animated.CompositeAnimation | null>(null);

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    progressAnim.current?.stop();

    // Exit: slide up + fade out simultaneously
    Animated.parallel([
      Animated.timing(translateY, {
        toValue:         ENTRY_OFFSET,
        duration:        240,
        useNativeDriver: true,
        easing:          Easing.in(Easing.cubic),
      }),
      Animated.timing(opacity, {
        toValue:         0,
        duration:        200,
        useNativeDriver: true,
        easing:          Easing.in(Easing.quad),
      }),
    ]).start(() => onDismiss());
  }, [onDismiss, translateY, opacity]);

  useEffect(() => {
    // Entrance: slide down from above + fade in
    Animated.parallel([
      Animated.spring(translateY, {
        toValue:           0,
        useNativeDriver:   true,
        damping:           22,
        stiffness:         280,
        mass:              0.75,
        overshootClamping: true,
      }),
      Animated.timing(opacity, {
        toValue:         1,
        duration:        220,
        useNativeDriver: true,
        easing:          Easing.out(Easing.cubic),
      }),
    ]).start();

    // Auto-dismiss progress drain
    progressAnim.current = Animated.timing(progress, {
      toValue:         0,
      duration:        AUTO_DISMISS_MS,
      useNativeDriver: false,
      easing:          Easing.linear,
    });
    progressAnim.current.start();

    timerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      progressAnim.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isReminder = announcement.type === "payment_reminder";
  const fresh      = isNew(announcement.createdAt);
  const showBadge  = isReminder || fresh;

  // For payment reminders show the amount line; for general show body preview
  const subtitle = isReminder
    ? (announcement.body.split("\n").filter(Boolean)[2] ?? announcement.body)
    : announcement.body;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        {
          top:        insets.top + 8,
          shadowColor: theme.shadowColor,
          transform:  [{ translateY }],
          opacity,
        },
      ]}
    >
      {/* ── Card ─────────────────────────────────────────────────────────── */}
      <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>

        {/* Left accent stripe */}
        <LinearGradient
          colors={theme.accentGrad}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.accentBar}
        />

        {/* Icon */}
        <View style={[styles.iconWrap, { backgroundColor: theme.iconBg, borderColor: theme.iconBorder }]}>
          <ToastIcon theme={theme} />
        </View>

        {/* Text */}
        <View style={styles.textWrap}>
          <View style={styles.titleRow}>
            {showBadge && (
              <View style={[styles.badge, { backgroundColor: theme.badgeBg }]}>
                <Text style={[styles.badgeText, { color: theme.badgeTextColor }]}>
                  {isReminder ? "DUE" : "NEW"}
                </Text>
              </View>
            )}
            <Text style={[styles.title, { color: theme.titleColor }]} numberOfLines={1}>
              {announcement.title}
            </Text>
          </View>

          {!!subtitle && (
            <Text style={[styles.subtitle, { color: theme.subtitleColor }]} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>

        {/* Close */}
        <Pressable onPress={dismiss} hitSlop={14} style={styles.closeBtn}>
          <View style={[styles.closeCircle, { backgroundColor: theme.closeBg, borderColor: theme.closeBorder }]}>
            <Feather name="x" size={11} color={theme.closeIconColor} />
          </View>
        </Pressable>
      </View>

      {/* ── Progress bar ─────────────────────────────────────────────────── */}
      <View style={[styles.progressTrack, { backgroundColor: theme.progressBg }]}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              backgroundColor: theme.progressFg,
              width: progress.interpolate({
                inputRange:  [0, 1],
                outputRange: ["0%", "100%"],
              }),
            },
          ]}
        />
      </View>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    position:      "absolute",
    left:          H_MARGIN,
    right:         H_MARGIN,
    zIndex:        9999,
    borderRadius:  16,
    shadowOffset:  { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius:  18,
    elevation:     14,
  },

  card: {
    flexDirection:  "row",
    alignItems:     "center",
    borderRadius:   16,
    borderWidth:    1,
    overflow:       "hidden",
    minHeight:      50,
    paddingRight:   10,
    gap:            10,
  },

  accentBar: {
    width:          3,
    alignSelf:      "stretch",
  },

  iconWrap: {
    width:          30,
    height:         30,
    borderRadius:   9,
    borderWidth:    1,
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },

  textWrap: {
    flex:    1,
    gap:     2,
    paddingVertical: 10,
  },

  titleRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           6,
  },

  badge: {
    borderRadius:      5,
    paddingHorizontal: 5,
    paddingVertical:   1.5,
    flexShrink:        0,
  },
  badgeText: {
    fontSize:      9,
    fontWeight:    "800",
    letterSpacing: 0.5,
  },

  title: {
    flex:          1,
    fontSize:      13,
    fontWeight:    "700",
    lineHeight:    18,
    letterSpacing: -0.1,
  },

  subtitle: {
    fontSize:   12,
    lineHeight: 16,
    fontWeight: "400",
  },

  closeBtn:    { flexShrink: 0 },
  closeCircle: {
    width:          24,
    height:         24,
    borderRadius:   12,
    borderWidth:    1,
    alignItems:     "center",
    justifyContent: "center",
  },

  progressTrack: {
    height:                  2,
    borderBottomLeftRadius:  16,
    borderBottomRightRadius: 16,
    overflow:                "hidden",
  },
  progressFill: {
    height:                 "100%",
    borderBottomLeftRadius: 16,
  },
});
