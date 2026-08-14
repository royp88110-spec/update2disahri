import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GradientBackground } from "@/components/GradientBackground";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import type { Announcement } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";
import { useRefresh } from "@/hooks/useRefresh";
import { EMERALD, ORANGE, PRIMARY, PRIMARY2, YELLOW } from "@/constants/colors";

// ── Helpers ────────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diffMs  = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr  = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1)   return "Just now";
  if (diffMin < 60)  return `${diffMin}m ago`;
  if (diffHr  < 24)  return `${diffHr}h ago`;
  if (diffDay === 1) return "Yesterday";
  if (diffDay  < 7)  return `${diffDay} days ago`;

  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: diffDay > 365 ? "numeric" : undefined,
  });
}

function isNew(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < 48 * 3_600_000;
}

// Cycling accents for general announcements
const ACCENTS: { grad: [string, string]; icon: React.ComponentProps<typeof Feather>["name"] }[] = [
  { grad: [PRIMARY, PRIMARY2], icon: "volume-2" },
  { grad: [ORANGE,  "#DC6803"], icon: "bell"    },
  { grad: [EMERALD, "#059669"], icon: "info"    },
  { grad: [YELLOW,  "#D97706"], icon: "star"    },
];

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function NoticesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { announcements } = useData();
  const { refreshing, onRefresh } = useRefresh();

  const memberId = user?.memberId ?? "";

  // Only show: general announcements + payment reminders targeted at this member
  const visible = announcements.filter(
    (a) =>
      a.type === "general" ||
      (a.type === "payment_reminder" && a.targetMemberId === memberId),
  );

  const newCount      = visible.filter((a) => isNew(a.createdAt)).length;
  const reminderCount = visible.filter((a) => a.type === "payment_reminder").length;

  // Index counter for cycling general announcement accents
  let generalIndex = -1;

  return (
    <GradientBackground>
      <ScreenHeader
        title="Notice Board"
        subtitle={
          visible.length === 0
            ? "No notices yet"
            : newCount > 0
            ? `${newCount} new · ${visible.length} total`
            : `${visible.length} announcement${visible.length !== 1 ? "s" : ""}`
        }
      />

      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 108 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[PRIMARY]}
            tintColor={PRIMARY}
          />
        }
      >
        {/* ── Pending payment reminder banner ─────────────────────────────── */}
        {reminderCount > 0 && (
          <View style={[styles.reminderBanner, { borderColor: `${ORANGE}35`, backgroundColor: `${ORANGE}10` }]}>
            <Feather name="bell" size={15} color={ORANGE} style={{ marginTop: 1 }} />
            <Text style={[styles.reminderBannerText, { color: ORANGE }]}>
              You have {reminderCount} pending payment reminder{reminderCount !== 1 ? "s" : ""}. Please settle at your earliest.
            </Text>
          </View>
        )}

        {visible.length === 0 ? (
          /* ── Empty state ────────────────────────────────────────────────── */
          <View style={styles.empty}>
            <LinearGradient colors={[`${PRIMARY}18`, `${PRIMARY}08`]} style={styles.emptyIcon}>
              <Feather name="bell-off" size={44} color={PRIMARY} style={{ opacity: 0.55 }} />
            </LinearGradient>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>All Clear!</Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
              No announcements from the mess admin yet. Check back later.
            </Text>
          </View>
        ) : (
          /* ── Notice cards ───────────────────────────────────────────────── */
          visible.map((a) => {
            if (a.type === "payment_reminder") {
              return <PaymentReminderCard key={a.id} a={a} colors={colors} />;
            }
            generalIndex += 1;
            const accent = ACCENTS[generalIndex % ACCENTS.length];
            return <GeneralCard key={a.id} a={a} accent={accent} colors={colors} />;
          })
        )}
      </ScrollView>
    </GradientBackground>
  );
}

// ── General Announcement Card ──────────────────────────────────────────────────

function GeneralCard({
  a,
  accent,
  colors,
}: {
  a: Announcement;
  accent: typeof ACCENTS[number];
  colors: ReturnType<typeof useColors>;
}) {
  const fresh = isNew(a.createdAt);
  return (
    <View style={[styles.card, { backgroundColor: colors.card }, fresh && styles.cardFresh]}>
      <LinearGradient colors={accent.grad} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.accentBar} />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <View style={[styles.iconCircle, { backgroundColor: `${accent.grad[0]}18` }]}>
            <Feather name={accent.icon} size={15} color={accent.grad[0]} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
            {a.title}
          </Text>
          {fresh && (
            <View style={[styles.newBadge, { backgroundColor: EMERALD }]}>
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
          )}
        </View>
        {!!a.body && (
          <Text style={[styles.body, { color: colors.mutedForeground }]}>{a.body}</Text>
        )}
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <View style={styles.footerLeft}>
            <Feather name="clock" size={11} color={colors.mutedForeground} />
            <Text style={[styles.timeRel, { color: colors.mutedForeground }]}>{relativeTime(a.createdAt)}</Text>
          </View>
          <Text style={[styles.timeAbs, { color: colors.mutedForeground }]}>
            {new Date(a.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ── Payment Reminder Card ──────────────────────────────────────────────────────

function PaymentReminderCard({
  a,
  colors,
}: {
  a: Announcement;
  colors: ReturnType<typeof useColors>;
}) {
  const fresh = isNew(a.createdAt);
  return (
    <View style={[styles.card, styles.reminderCard, { backgroundColor: colors.card }]}>
      <LinearGradient colors={[ORANGE, "#EA580C"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.accentBar} />
      <View style={styles.cardBody}>
        {/* Header */}
        <View style={styles.cardTop}>
          <View style={[styles.iconCircle, { backgroundColor: `${ORANGE}18` }]}>
            <Feather name="bell" size={15} color={ORANGE} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
            {a.title}
          </Text>
          <View style={[styles.newBadge, { backgroundColor: ORANGE }]}>
            <Text style={styles.newBadgeText}>{fresh ? "NEW" : "DUE"}</Text>
          </View>
        </View>

        {/* Body — pre-formatted reminder text with line breaks */}
        {!!a.body && (
          <Text style={[styles.reminderBody, { color: colors.foreground }]}>{a.body}</Text>
        )}

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: `${ORANGE}25` }]}>
          <View style={styles.footerLeft}>
            <Feather name="clock" size={11} color={ORANGE} />
            <Text style={[styles.timeRel, { color: ORANGE }]}>{relativeTime(a.createdAt)}</Text>
          </View>
          <Text style={[styles.timeAbs, { color: colors.mutedForeground }]}>
            {new Date(a.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  list: { padding: 20, gap: 14 },

  // ── Reminder banner ──
  reminderBanner: {
    borderRadius: 14, borderWidth: 1, padding: 12,
    flexDirection: "row", alignItems: "flex-start", gap: 10,
  },
  reminderBannerText: { flex: 1, fontSize: 13, fontWeight: "600", lineHeight: 19 },

  // ── Card ──
  card: {
    borderRadius: 20, flexDirection: "row", overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(148,163,184,0.22)",
    shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 14, elevation: 5,
  },
  cardFresh: {
    borderColor: `${EMERALD}30`,
    shadowColor: EMERALD,
    shadowOpacity: 0.12,
  },
  reminderCard: {
    borderColor: `${ORANGE}30`,
    shadowColor: ORANGE,
    shadowOpacity: 0.14,
  },
  accentBar: { width: 5 },
  cardBody: { flex: 1, padding: 14, gap: 10 },

  // Header row
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  iconCircle: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1,
  },
  title: { flex: 1, fontSize: 15, fontWeight: "700", lineHeight: 21 },
  newBadge: {
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
    flexShrink: 0, alignSelf: "flex-start",
  },
  newBadgeText: { fontSize: 9, fontWeight: "800", color: "#fff", letterSpacing: 0.8 },

  // Body
  body: { fontSize: 13, lineHeight: 20, paddingLeft: 44 },
  reminderBody: { fontSize: 13.5, lineHeight: 22, fontWeight: "400" },

  // Footer
  footer: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingLeft: 44, paddingTop: 8, borderTopWidth: 1, marginTop: 2,
  },
  footerLeft: { flexDirection: "row", alignItems: "center", gap: 5 },
  timeRel: { fontSize: 11, fontWeight: "600" },
  timeAbs: { fontSize: 11 },

  // ── Empty ──
  empty: { marginTop: 72, alignItems: "center", paddingHorizontal: 32, gap: 14 },
  emptyIcon: { width: 110, height: 110, borderRadius: 55, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 22, fontWeight: "800" },
  emptyBody: { fontSize: 14, textAlign: "center", lineHeight: 22 },
});
