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
  Dimensions,
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
const SCREEN_W         = Dimensions.get("window").width;
const CARD_WIDTH       = Math.min(600, Math.max(0, SCREEN_W - H_MARGIN * 2));
// Offset beyond the right edge used for entrance/exit animation
const ENTRY_OFFSET     = SCREEN_W + 24;

// ─── Theme ────────────────────────────────────────────────────────────────────

interface Theme {
  accentGrad:     readonly [string, string];
  cardGradient:   readonly [string, string, string];
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
      accentGrad:     ["#B8F0FF", "#6EC8E8"],
      cardGradient:   ["#071A33", "#123A60", "#255F7C"],
      cardBorder:     "rgba(184,240,255,0.34)",
      shadowColor:    "#071A33",
      iconBg:         "rgba(184,240,255,0.18)",
      iconBorder:     "rgba(184,240,255,0.52)",
      iconColor:      "#B8F0FF",
      iconFamily:     "feather",
      iconName:       "bell",
      titleColor:     "#F7FCFF",
      subtitleColor:  "#D6F3FF",
      badgeBg:        "#B8F0FF",
      badgeText:      "DUE",
      badgeTextColor: "#071A33",
      closeBg:        "rgba(255,255,255,0.12)",
      closeBorder:    "rgba(184,240,255,0.34)",
      closeIconColor: "#E8FAFF",
      progressBg:     "rgba(184,240,255,0.16)",
      progressFg:     "#B8F0FF",
    };
  }
  return {
    accentGrad:     ["#B8F0FF", "#6EC8E8"],
    cardGradient:   ["#071A33", "#123A60", "#255F7C"],
    cardBorder:     "rgba(184,240,255,0.34)",
    shadowColor:    "#071A33",
    iconBg:         "rgba(184,240,255,0.18)",
    iconBorder:     "rgba(184,240,255,0.52)",
    iconColor:      "#B8F0FF",
    iconFamily:     "ionicons",
    iconName:       "megaphone",
    titleColor:     "#F7FCFF",
    subtitleColor:  "#D6F3FF",
    badgeBg:        "#B8F0FF",
    badgeText:      "NEW",
    badgeTextColor: "#071A33",
    closeBg:        "rgba(255,255,255,0.12)",
    closeBorder:    "rgba(184,240,255,0.34)",
    closeIconColor: "#E8FAFF",
    progressBg:     "rgba(184,240,255,0.16)",
    progressFg:     "#B8F0FF",
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
  const translateX = useRef(new Animated.Value(ENTRY_OFFSET)).current;
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

    // Exit: slide right + fade out simultaneously
    Animated.parallel([
      Animated.timing(translateX, {
        toValue:         ENTRY_OFFSET,
        duration:        260,
        useNativeDriver: true,
        easing:          Easing.inOut(Easing.cubic),
      }),
      Animated.timing(opacity, {
        toValue:         0,
        duration:        200,
        useNativeDriver: true,
        easing:          Easing.in(Easing.quad),
      }),
    ]).start(() => onDismiss());
  }, [onDismiss, translateX, opacity]);

  useEffect(() => {
    // Entrance: slide in from the right without bounce
    Animated.parallel([
      Animated.timing(translateX, {
        toValue:         0,
        duration:        320,
        useNativeDriver: true,
        easing:          Easing.out(Easing.cubic),
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
          width:      CARD_WIDTH,
          transform:  [{ translateX }],
          opacity,
        },
      ]}
    >
      {/* ── Card ─────────────────────────────────────────────────────────── */}
      <LinearGradient
        colors={theme.cardGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, { borderColor: theme.cardBorder }]}
      >

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
      </LinearGradient>

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
    justifyContent: "center",
    borderRadius:   16,
    borderWidth:    1,
    overflow:       "hidden",
    width:          "100%",
    height:         280,
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
    fontWeight:    "800",
    lineHeight:    18,
    letterSpacing: -0.1,
  },

  subtitle: {
    fontSize:   12,
    lineHeight: 16,
    fontWeight: "600",
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
