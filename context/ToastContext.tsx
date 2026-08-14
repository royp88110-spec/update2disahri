/**
 * ToastContext — global slide-in toast system.
 *
 * Usage:
 *   const { showToast } = useToast();
 *   showToast("Title", "Optional message", "success" | "error" | "warning" | "info");
 *
 * Toasts slide in from the right, stay 3.5 s, then slide out.
 * Users can also tap ✕ to dismiss immediately.
 */

import { Feather } from "@expo/vector-icons";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EMERALD, ORANGE, PRIMARY, RED } from "@/constants/colors";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ToastType = "success" | "error" | "warning" | "info";

interface ToastEntry {
  id: string;
  title: string;
  message?: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (title: string, message?: string, type?: ToastType) => void;
}

// ── Per-type visual config ────────────────────────────────────────────────────

type ToastCfg = {
  color: string;
  bgTint: string;
  icon: React.ComponentProps<typeof Feather>["name"];
};

const CFG: Record<ToastType, ToastCfg> = {
  success: { color: EMERALD,  bgTint: `${EMERALD}1A`,  icon: "check-circle"   },
  error:   { color: RED,      bgTint: `${RED}1A`,      icon: "x-circle"       },
  warning: { color: ORANGE,   bgTint: `${ORANGE}1A`,   icon: "alert-triangle" },
  info:    { color: PRIMARY,  bgTint: `${PRIMARY}1A`,  icon: "info"           },
};

const SCREEN_W     = Dimensions.get("window").width;
const BUBBLE_W     = SCREEN_W - 32;
const DISMISS_AFTER = 3500;

// ── Context ───────────────────────────────────────────────────────────────────

const ToastCtx = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastCtx);
}

// ── Single Toast bubble ───────────────────────────────────────────────────────

const ToastBubble = React.memo(function ToastBubble({
  entry,
  onGone,
}: {
  entry: ToastEntry;
  onGone: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const cfg    = CFG[entry.type];

  // Native-driver animated values — runs on the UI thread at 60 fps
  const tx      = useRef(new Animated.Value(SCREEN_W + 20)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale   = useRef(new Animated.Value(0.94)).current;
  const timer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Slide out + fade, then remove from queue */
  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    Animated.parallel([
      Animated.spring(tx, {
        toValue: SCREEN_W + 20,
        useNativeDriver: true,
        damping: 22,
        stiffness: 280,
        mass: 0.7,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(() => onGone(entry.id));
  }, [entry.id, onGone, tx, opacity]);

  useEffect(() => {
    // Slide in from right with a spring
    Animated.parallel([
      Animated.spring(tx, {
        toValue: 0,
        useNativeDriver: true,
        damping: 15,
        stiffness: 170,
        mass: 0.88,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 14,
        stiffness: 180,
      }),
    ]).start();

    timer.current = setTimeout(dismiss, DISMISS_AFTER);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const top = Math.max(insets.top + 12, 48);

  return (
    <Animated.View
      style={[
        styles.bubble,
        {
          top,
          opacity,
          shadowColor: cfg.color,
          transform: [{ translateX: tx }, { scale }],
        },
      ]}
    >
      {/* Gradient-like left accent strip */}
      <View style={[styles.strip, { backgroundColor: cfg.color }]} />

      {/* Icon */}
      <View style={[styles.iconWrap, { backgroundColor: cfg.bgTint }]}>
        <Feather name={cfg.icon} size={20} color={cfg.color} />
      </View>

      {/* Text content */}
      <View style={styles.textBlock}>
        <Text style={styles.titleText} numberOfLines={1}>
          {entry.title}
        </Text>
        {!!entry.message && (
          <Text style={styles.msgText} numberOfLines={2}>
            {entry.message}
          </Text>
        )}
      </View>

      {/* Dismiss button */}
      <Pressable
        onPress={dismiss}
        hitSlop={14}
        style={styles.closeBtn}
        android_ripple={{ color: "rgba(0,0,0,0.06)", borderless: true, radius: 18 }}
      >
        <Feather name="x" size={15} color="#9CA3AF" />
      </Pressable>
    </Animated.View>
  );
});

// ── Provider ──────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<ToastEntry[]>([]);

  const showToast = useCallback(
    (title: string, message?: string, type: ToastType = "info") => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setQueue((q) => [...q, { id, title, message, type }]);
    },
    [],
  );

  const onGone = useCallback((id: string) => {
    setQueue((q) => q.filter((e) => e.id !== id));
  }, []);

  // Show one toast at a time; the next auto-appears when the first exits
  const current = queue[0];

  return (
    <ToastCtx.Provider value={{ showToast }}>
      {children}
      {current && (
        <ToastBubble key={current.id} entry={current} onGone={onGone} />
      )}
    </ToastCtx.Provider>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  bubble: {
    position: "absolute",
    right: 16,
    width: BUBBLE_W,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.97)",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.16)",
    // Shadow — colour overridden inline per-type
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 18,
    zIndex: 9999,
  },
  strip: {
    width: 5,
    alignSelf: "stretch",
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 13,
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  titleText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E1B4B",
    lineHeight: 19,
  },
  msgText: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 3,
    lineHeight: 17,
  },
  closeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 18,
  },
});
