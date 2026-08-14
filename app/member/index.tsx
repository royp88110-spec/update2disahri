import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useToast } from "@/context/ToastContext";
import { useColors } from "@/hooks/useColors";
import { ScreenHeader } from "@/components/ScreenHeader";
import { GradientBackground } from "@/components/GradientBackground";
import { useRefresh } from "@/hooks/useRefresh";
import { PRIMARY, EMERALD, RED, CYAN, ORANGE, YELLOW } from "@/constants/colors";

// ── Month helpers ─────────────────────────────────────────────────────────────
function getCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function prevMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function nextMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(m: string) {
  const [y, mo] = m.split("-");
  const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${names[parseInt(mo) - 1]} ${y}`;
}

/** Safe toFixed: returns "0" for NaN / non-finite inputs. */
function safeFix(n: number, digits = 0): string {
  return Number.isFinite(n) ? n.toFixed(digits) : "0";
}

function fmtDate(iso: string) {
  return iso.slice(0, 10);
}

// ── Payment-state helpers ─────────────────────────────────────────────────────
type PaymentState = "full" | "partial" | "none";

// ── Component ─────────────────────────────────────────────────────────────────
export default function MemberHome() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const {
    calculateMonthlyBill, announcements, payments, settings, isLoaded,
  } = useData();
  const { showToast } = useToast();
  const { refreshing, onRefresh } = useRefresh();
  const [month, setMonth] = useState(getCurrentMonth());

  const memberId = user?.memberId ?? "";

  // ── Derived data ──────────────────────────────────────────────────────────
  const bill    = calculateMonthlyBill(memberId, month);
  const payment = payments.find((p) => p.memberId === memberId && p.month === month);

  const paidAmount: number = payment?.amount ?? 0;
  const paymentState: PaymentState =
    payment?.paid  ? "full"    :
    paidAmount > 0 ? "partial" :
                     "none";
  const remainingDue = Math.max(0, bill.dueAmount - paidAmount);

  // ── Realtime payment-change toast ─────────────────────────────────────────
  const prevPayRef = useRef<{ paid: boolean; amount: number } | undefined>(undefined);

  useEffect(() => {
    prevPayRef.current = undefined;
  }, [month]);

  useEffect(() => {
    if (!payment) {
      prevPayRef.current = undefined;
      return;
    }
    const prev = prevPayRef.current;
    prevPayRef.current = { paid: payment.paid, amount: payment.amount };

    if (prev === undefined) return;
    if (prev.paid === payment.paid && prev.amount === payment.amount) return;

    if (payment.paid && !prev.paid) {
      showToast(
        "Payment Complete 🎉",
        `₹${safeFix(payment.amount)} recorded for ${monthLabel(month)}`,
        "success",
      );
    } else if (payment.amount > prev.amount) {
      const rem = safeFix(Math.max(0, bill.dueAmount - payment.amount));
      showToast(
        "Payment Updated",
        `₹${safeFix(payment.amount)} received · ₹${rem} remaining`,
        "warning",
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment?.paid, payment?.amount]);

  // ── Loading guard ─────────────────────────────────────────────────────────
  if (!isLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const recentAnnouncements = announcements.slice(0, 3);

  const handleLogout = () =>
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: () => { void logout(); } },
    ]);

  const miniStats = [
    { label: "Meals",      val: `${bill.mealCount}`,                icon: "grid",         color: CYAN,    bg: `${CYAN}20`    },
    { label: "Meal Cost",  val: `₹${safeFix(bill.mealBill)}`,       icon: "dollar-sign",  color: ORANGE,  bg: `${ORANGE}20` },
    { label: "Egg Cost",   val: `₹${safeFix(bill.eggBill)}`,        icon: "sun",          color: YELLOW,  bg: `${YELLOW}20` },
    { label: "Fine",       val: `₹${safeFix(bill.fineTotal)}`,      icon: "alert-circle", color: RED,     bg: `${RED}20`    },
    { label: "Advance",    val: `₹${safeFix(bill.totalAdvance)}`,   icon: "credit-card",  color: EMERALD, bg: `${EMERALD}20` },
    { label: "Amount Due", val: `₹${safeFix(bill.dueAmount)}`,      icon: "trending-up",  color: PRIMARY, bg: `${PRIMARY}20` },
  ] as const;

  const card        = colors.card;
  const cardText    = colors.cardForeground;
  const muted       = colors.mutedForeground;
  const borderColor = colors.border;

  const bannerColors: [string, string] =
    paymentState === "full"    ? [EMERALD, "#10B981"] :
    paymentState === "partial" ? [ORANGE,  "#D97706"] :
                                  [RED,     "#E11D48"];

  const bannerIcon: React.ComponentProps<typeof Feather>["name"] =
    paymentState === "full"    ? "check-circle"  :
    paymentState === "partial" ? "zap"           :
                                  "clock";

  const bannerTitle =
    paymentState === "full"    ? "Payment Complete ✓" :
    paymentState === "partial" ? "Partial Payment"    :
                                  "Payment Pending";

  const bannerSub =
    paymentState === "full"
      ? `Paid ₹${safeFix(payment?.amount ?? 0)} · ${payment?.paidAt?.slice(0, 10) ?? ""}`
    : paymentState === "partial"
      ? `Paid ₹${safeFix(paidAmount)} of ₹${safeFix(bill.dueAmount)} · ₹${safeFix(remainingDue)} remaining`
    : `₹${safeFix(bill.dueAmount)} due for ${monthLabel(month)}`;

  const bannerPillLabel =
    paymentState === "full"    ? "PAID"    :
    paymentState === "partial" ? "PARTIAL" :
                                  "DUE";

  const isDuePaid   = paymentState === "full" || bill.dueAmount <= 0;
  const dueCardColors: [string, string] =
    isDuePaid                            ? [EMERALD, "#10B981"] :
    paymentState === "partial"           ? [ORANGE,  "#EA580C"] :
                                           [RED,     "#E11D48"];

  const dueCardLabel =
    isDuePaid                  ? "Fully Paid"    :
    paymentState === "partial" ? "Remaining Due" :
                                  "Amount Due";

  const dueCardIcon: React.ComponentProps<typeof Feather>["name"] =
    isDuePaid                  ? "check-circle"  :
    paymentState === "partial" ? "minus-circle"  :
                                  "alert-circle";

  const dueCardAmount =
    isDuePaid ? 0 :
    bill.dueAmount <= 0 ? 0 :
    remainingDue;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <GradientBackground>
      <ScreenHeader
        title={`Hi, ${user?.name?.split(" ")[0] ?? "Member"} 👋`}
        subtitle="Your monthly overview"
        avatarName={user?.name}
        avatarUrl={user?.photoUrl}
        rightElement={
          <Pressable onPress={handleLogout} style={styles.logoutBtn} hitSlop={10}>
            <Feather name="log-out" size={20} color="rgba(255,255,255,0.85)" />
          </Pressable>
        }
        bottomElement={
          <View style={styles.headerMonthNav}>
            <Pressable onPress={() => setMonth(prevMonth(month))} style={styles.headerNavBtn}>
              <Feather name="chevron-left" size={20} color="rgba(255,255,255,0.9)" />
            </Pressable>
            <Text style={styles.headerMonthText}>{monthLabel(month)}</Text>
            <Pressable onPress={() => setMonth(nextMonth(month))} style={styles.headerNavBtn}>
              <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.9)" />
            </Pressable>
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 108 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[PRIMARY]}
            tintColor={PRIMARY}
          />
        }
      >
        {/* ── Payment Status Banner ─────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
          <LinearGradient
            colors={bannerColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.paymentBanner}
          >
            <View style={styles.paymentBannerLeft}>
              <View style={styles.paymentBannerBadge}>
                <Feather name={bannerIcon} size={20} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.paymentBannerTitle}>{bannerTitle}</Text>
                <Text style={styles.paymentBannerSub}>{bannerSub}</Text>
              </View>
            </View>
            <View style={[
              styles.paymentBannerPill,
              paymentState === "partial" && styles.paymentBannerPillPartial,
            ]}>
              <Text style={styles.paymentBannerPillText}>{bannerPillLabel}</Text>
            </View>
          </LinearGradient>
        </View>

        {/* ── Amount Due / Status card ──────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
          <LinearGradient
            colors={dueCardColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.dueCard}
          >
            <View style={styles.dueCardInner}>
              <View style={styles.dueCardLeft}>
                <Text style={styles.dueCardLabel}>{dueCardLabel}</Text>
                <Text style={styles.dueCardAmount}>
                  ₹{safeFix(dueCardAmount, 2)}
                </Text>
                <Text style={styles.dueCardSub}>{monthLabel(month)}</Text>
                {paymentState === "partial" && bill.dueAmount > 0 && (
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${Math.min(100, (paidAmount / bill.dueAmount) * 100)}%` as `${number}%` },
                      ]}
                    />
                  </View>
                )}
              </View>
              <View style={styles.dueCardIcon}>
                <Feather
                  name={dueCardIcon}
                  size={48}
                  color="rgba(255,255,255,0.35)"
                />
              </View>
            </View>
            <View style={styles.breakdownStrip}>
              {[
                { key: "Meals", val: `₹${safeFix(bill.mealBill)}` },
                { key: "Eggs",  val: `₹${safeFix(bill.eggBill)}`  },
                { key: "Cook",  val: `₹${safeFix(bill.cookShare)}` },
                { key: "Fines", val: `₹${safeFix(bill.fineTotal)}` },
                { key: "Paid",  val: `₹${safeFix(bill.totalAdvance)}` },
              ].map(({ key, val }, i) => (
                <React.Fragment key={key}>
                  {i > 0 && <View style={styles.breakdownDivider} />}
                  <View style={styles.breakdownItem}>
                    <Text style={styles.breakdownVal}>{val}</Text>
                    <Text style={styles.breakdownKey}>{key}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
          </LinearGradient>
        </View>

        {/* ── Mini stats ────────────────────────────────────────────────── */}
        <View>
          <View style={styles.miniStatsRow}>
            {miniStats.map(({ label, val, icon, color, bg }) => (
              <View key={label} style={[styles.miniStatCard, { backgroundColor: card }]}>
                <View style={[styles.miniStatIcon, { backgroundColor: bg }]}>
                  <Feather name={icon as "grid"} size={18} color={color} />
                </View>
                <Text style={[styles.miniStatVal, { color: cardText }]}>{val}</Text>
                <Text style={[styles.miniStatLabel, { color: muted }]}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Go to Payments Card ───────────────────────────────────────── */}
        <View style={styles.section}>
          <Pressable
            style={({ pressed }) => [styles.sectionCard, { backgroundColor: card, opacity: pressed ? 0.92 : 1 }]}
            onPress={() => router.navigate("/member/payments")}
          >
            <View style={styles.sectionCardHeader}>
              <View style={[styles.sectionCardIcon, { backgroundColor: "#7C3AED15" }]}>
                <Feather name="credit-card" size={18} color="#7C3AED" />
              </View>
              <Text style={[styles.sectionCardTitle, { color: cardText }]}>View Full Bill & Pay</Text>
              <Feather name="chevron-right" size={18} color={muted} style={{ marginLeft: "auto" }} />
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 12 }}>
              <View>
                <Text style={{ fontSize: 12, color: muted }}>Remaining Due</Text>
                <Text style={{ fontSize: 20, fontWeight: "800", color: remainingDue > 0 ? RED : EMERALD }}>
                  ₹{safeFix(remainingDue, 2)}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontSize: 12, color: muted }}>Monthly Bill</Text>
                <Text style={{ fontSize: 20, fontWeight: "800", color: PRIMARY }}>
                  ₹{safeFix(bill.dueAmount, 2)}
                </Text>
              </View>
            </View>
            <View style={{ marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: "#7C3AED10", flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Feather name="send" size={14} color="#7C3AED" />
              <Text style={{ fontSize: 13, color: "#7C3AED", fontWeight: "600" }}>
                Tap to view bill details and submit UPI payment
              </Text>
            </View>
          </Pressable>
        </View>

        {/* ── Egg Bill Card ─────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={[styles.sectionCard, { backgroundColor: card }]}>
            <View style={styles.sectionCardHeader}>
              <View style={[styles.sectionCardIcon, { backgroundColor: `${YELLOW}20` }]}>
                <Feather name="sun" size={18} color={YELLOW} />
              </View>
              <Text style={[styles.sectionCardTitle, { color: cardText }]}>Egg Bill</Text>
            </View>
            {[
              { label: "Total Eggs Consumed", val: `${bill.eggCount} egg${bill.eggCount !== 1 ? "s" : ""}` },
              { label: "Egg Price",            val: `₹${settings.eggPrice} / egg` },
              { label: "Egg Total Cost",        val: `₹${safeFix(bill.eggBill, 2)}` },
            ].map(({ label, val }) => (
              <View key={label} style={[styles.billRow, { borderBottomColor: borderColor }]}>
                <Text style={[styles.billLabel, { color: muted }]}>{label}</Text>
                <Text style={[styles.billVal, { color: cardText }]}>{val}</Text>
              </View>
            ))}
            <View style={[styles.eggNote, { backgroundColor: `${YELLOW}12`, borderColor: `${YELLOW}30` }]}>
              <Feather name="info" size={13} color={YELLOW} />
              <Text style={[styles.eggNoteText, { color: muted }]}>
                Egg cost is included in your monthly gross bill.
              </Text>
            </View>
          </View>
        </View>

        {/* ── Announcements ─────────────────────────────────────────────── */}
        {recentAnnouncements.length > 0 && (
          <View style={[styles.section, { marginBottom: 8 }]}>
            <Text style={[styles.sectionTitle, { color: cardText }]}>📣 Announcements</Text>
            {recentAnnouncements.map((a, i) => (
              <View
                key={a.id}
                style={[
                  styles.announcementCard,
                  { marginTop: i === 0 ? 12 : 10, backgroundColor: card, borderColor: `${PRIMARY}18` },
                ]}
              >
                <View style={[styles.announcementDot, { backgroundColor: PRIMARY }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.announcementTitle, { color: cardText }]}>{a.title}</Text>
                  {a.body ? (
                    <Text style={[styles.announcementBody, { color: muted }]}>{a.body}</Text>
                  ) : null}
                  <Text style={[styles.announcementDate, { color: muted }]}>
                    {a.createdAt?.slice(0, 10) ?? ""}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

    </GradientBackground>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Header
  logoutBtn: {
    width: 38, height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center", justifyContent: "center",
  },
  headerMonthNav: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", paddingVertical: 4,
  },
  headerNavBtn: { padding: 8 },
  headerMonthText: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: "#fff" },

  // Payment banner
  paymentBanner: {
    borderRadius: 20, paddingHorizontal: 18, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 12, elevation: 8,
  },
  paymentBannerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  paymentBannerBadge: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center", justifyContent: "center",
  },
  paymentBannerTitle: { fontSize: 15, fontWeight: "800", color: "#fff" },
  paymentBannerSub: { fontSize: 12, color: "rgba(255,255,255,0.82)", marginTop: 2 },
  paymentBannerPill: {
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  paymentBannerPillPartial: { paddingHorizontal: 10 },
  paymentBannerPillText: { fontSize: 10, fontWeight: "900", color: "#fff", letterSpacing: 0.8 },

  // Due card
  dueCard: {
    borderRadius: 28, overflow: "hidden",
    shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28, shadowRadius: 24, elevation: 14,
  },
  dueCardInner: { flexDirection: "row", alignItems: "center", padding: 24, paddingBottom: 20 },
  dueCardLeft: { flex: 1 },
  dueCardLabel: { fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.85)", marginBottom: 6 },
  dueCardAmount: { fontSize: 40, fontWeight: "900", color: "#fff", letterSpacing: -1 },
  dueCardSub: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 6 },
  dueCardIcon: { opacity: 0.8 },

  progressTrack: {
    marginTop: 10, height: 5, borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.25)", overflow: "hidden",
    width: "80%",
  },
  progressFill: {
    height: "100%", borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.85)",
  },

  breakdownStrip: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.15)",
    paddingVertical: 12, paddingHorizontal: 16,
  },
  breakdownItem: { flex: 1, alignItems: "center" },
  breakdownVal: { fontSize: 13, fontWeight: "700", color: "#fff" },
  breakdownKey: { fontSize: 9, color: "rgba(255,255,255,0.72)", marginTop: 2, fontWeight: "500" },
  breakdownDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.2)", marginHorizontal: 2 },

  // Mini stats
  miniStatsRow: {
    flexDirection: "row", flexWrap: "wrap", gap: 12,
    paddingHorizontal: 20, marginTop: 20, marginBottom: 4,
  },
  miniStatCard: {
    width: "47%", borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: "rgba(148,163,184,0.22)",
    shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
    alignItems: "center",
  },
  miniStatIcon: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: "center", justifyContent: "center", marginBottom: 10,
  },
  miniStatVal: { fontSize: 20, fontWeight: "800" },
  miniStatLabel: { fontSize: 12, marginTop: 3 },

  // Sections
  section: { paddingHorizontal: 20, marginTop: 20 },
  sectionTitle: { fontSize: 17, fontWeight: "700" },
  sectionCard: {
    borderRadius: 22,
    borderWidth: 1, borderColor: "rgba(148,163,184,0.22)",
    shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10, shadowRadius: 16, elevation: 6,
    padding: 18,
  },
  sectionCardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  sectionCardIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  sectionCardTitle: { fontSize: 16, fontWeight: "700", flex: 1 },

  // Bill rows
  billRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 11, borderBottomWidth: 1,
  },
  billRowFinal: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 14, borderTopWidth: 1.5, marginTop: 4,
  },
  billSectionDivider: { paddingBottom: 6, borderBottomWidth: 1, marginTop: 6, marginBottom: 2 },
  billSectionLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase" },
  billLabelRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  billIconDot: { width: 24, height: 24, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  billLabel: { fontSize: 14 },
  billVal: { fontSize: 15, fontWeight: "600" },

  // Egg note
  eggNote: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 8, marginTop: 10,
  },
  eggNoteText: { fontSize: 12, flex: 1, lineHeight: 17 },

  // Announcements
  announcementCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    borderRadius: 16, padding: 14, borderWidth: 1,
  },
  announcementDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  announcementTitle: { fontSize: 15, fontWeight: "700" },
  announcementBody: { fontSize: 13, marginTop: 3, lineHeight: 18 },
  announcementDate: { fontSize: 11, marginTop: 5 },

  // ── UPI Payment section ──
  pendingBadge: {
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  pendingBadgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },

  upiNotice: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  upiNoticeText: { fontSize: 13, flex: 1, lineHeight: 18 },

  upiAmountRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderRadius: 14, borderWidth: 1,
    paddingHorizontal: 16, paddingVertical: 12, marginBottom: 14,
  },
  upiAmountLabel: { fontSize: 12, fontWeight: "600", marginBottom: 3 },
  upiAmountVal: { fontSize: 28, fontWeight: "900", letterSpacing: -0.5 },

  upiIdRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 10, borderBottomWidth: 1,
  },
  upiIdIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  upiIdLabel: { fontSize: 11, fontWeight: "600", marginBottom: 2 },
  upiIdValue: { fontSize: 15, fontWeight: "700" },

  copyBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  copyBtnText: { fontSize: 12, fontWeight: "700" },

  qrContainer: {
    alignItems: "center", marginTop: 16, marginBottom: 4,
  },
  qrImage: {
    width: 180, height: 180, borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(148,163,184,0.22)",
  },
  qrLabel: { fontSize: 12, marginTop: 8 },

  payUpiBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, borderRadius: 16, paddingVertical: 16,
  },
  payUpiBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },

  iHavePaidBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, borderRadius: 12, borderWidth: 1.5,
    paddingVertical: 12, marginTop: 10,
  },
  iHavePaidText: { fontSize: 13, fontWeight: "600" },

  // Submission cards
  submissionCard: {
    borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 4,
  },
  submissionCardHeader: {
    flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10,
  },
  submissionCardTitle: { fontSize: 14, fontWeight: "700" },
  submissionRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 6, borderBottomWidth: 1,
  },
  submissionLabel: { fontSize: 12 },
  submissionVal: { fontSize: 13, fontWeight: "600" },
  submissionThumb: {
    width: "100%", height: 120, borderRadius: 10, marginTop: 10,
  },
  submissionThumbLabel: { fontSize: 11, textAlign: "center", marginTop: 4 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "#00000070", justifyContent: "flex-end" },
  modalSheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingTop: 12, maxHeight: "92%",
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(148,163,184,0.4)",
    alignSelf: "center", marginBottom: 16,
  },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: "800" },
  modalSubtitle: { fontSize: 13, marginTop: 2 },

  formGroup: { marginBottom: 16 },
  formLabel: { fontSize: 11, fontWeight: "700", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.6 },
  formInput: {
    borderWidth: 1.5, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 13, fontSize: 16,
  },

  screenshotPickerBtn: {
    borderWidth: 1.5, borderRadius: 14, borderStyle: "dashed",
    alignItems: "center", justifyContent: "center",
    paddingVertical: 28, gap: 8,
  },
  screenshotPickerText: { fontSize: 14 },
  screenshotPreview: { position: "relative" },
  screenshotImg: { width: "100%", height: 160, borderRadius: 12 },
  screenshotRemove: {
    position: "absolute", top: 8, right: 8,
    width: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },

  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, borderRadius: 16, paddingVertical: 16,
  },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },

  // Full-screen screenshot
  screenshotFullOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center", justifyContent: "center",
  },
  screenshotFull: { width: "90%", height: "80%" },
  screenshotFullClose: {
    position: "absolute", top: 56, right: 20,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
});
