import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useToast } from "@/context/ToastContext";
import { useColors } from "@/hooks/useColors";
import { ScreenHeader } from "@/components/ScreenHeader";
import { MemberAvatar } from "@/components/MemberAvatar";
import { useRefresh } from "@/hooks/useRefresh";
import { BG_GRADIENT, PRIMARY, EMERALD, RED, ORANGE } from "@/constants/colors";

const BG = BG_GRADIENT;

const SCREEN_WIDTH = Dimensions.get("window").width;
const SIDEBAR_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 340);

function monthLabel(m: string) {
  const [y, mo] = m.split("-");
  const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${names[parseInt(mo) - 1]} ${y}`;
}
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
function safeFix(n: number, digits = 0) {
  return Number.isFinite(n) ? n.toFixed(digits) : "0";
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  const colors = useColors();
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card }]}>
      <View style={styles.statCardInner}>
        <View style={[styles.statIcon, { backgroundColor: color + "18", alignSelf: "flex-start" }]}>
          <Feather name={icon as "home"} size={22} color={color} />
        </View>
        <Text style={[styles.statValue, { color: colors.cardForeground }]}>{value}</Text>
        <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
      </View>
    </View>
  );
}

function shortDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

// ─── Payment state helpers ─────────────────────────────────────────────────────
type PayState = "none" | "partial" | "full";

function getPayState(paid: boolean | undefined, amount: number | undefined): PayState {
  if (paid) return "full";
  if ((amount ?? 0) > 0) return "partial";
  return "none";
}

const PAY_STATE_COLOR: Record<PayState, string> = { none: RED, partial: ORANGE, full: EMERALD };
const PAY_STATE_LABEL: Record<PayState, string> = {
  none: "Pending",
  partial: "Partial",
  full: "Complete",
};
const PAY_STATE_ICON: Record<PayState, React.ComponentProps<typeof Feather>["name"]> = {
  none: "clock",
  partial: "zap",
  full: "check-circle",
};

// ─── Payment Modal ─────────────────────────────────────────────────────────────
interface PayModalProps {
  visible: boolean;
  memberName: string;
  dueAmount: number;   // net cash owed (grossBill − advances)
  alreadyPaid: number;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (amount: number) => void;
}

function PaymentModal({ visible, memberName, dueAmount, alreadyPaid, submitting, onClose, onSubmit }: PayModalProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<TextInput>(null);

  const remaining = Math.max(0, dueAmount - alreadyPaid);
  const entered   = parseFloat(input) || 0;
  const afterThis = Math.max(0, remaining - entered);
  const isOver    = entered > remaining + 0.001;
  const isZero    = entered <= 0;
  const canSubmit = !isOver && !isZero && !submitting;

  const handleClose = () => { setInput(""); onClose(); };
  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(entered);
    setInput("");
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={[styles.modalHeaderIcon, { backgroundColor: `${PRIMARY}18` }]}>
              <Feather name="credit-card" size={20} color={PRIMARY} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Record Payment</Text>
              <Text style={styles.modalSub} numberOfLines={1}>{memberName}</Text>
            </View>
            <Pressable onPress={handleClose} style={styles.modalClose} hitSlop={8}>
              <Feather name="x" size={20} color="#6B7280" />
            </Pressable>
          </View>

          {/* Info rows */}
          <View style={styles.modalInfoBlock}>
            {[
              { label: "Total Due (Cash)", value: `₹${safeFix(dueAmount, 2)}`, color: RED },
              { label: "Already Paid",     value: `₹${safeFix(alreadyPaid, 2)}`, color: EMERALD },
              { label: "Remaining Due",    value: `₹${safeFix(remaining, 2)}`,   color: remaining > 0 ? ORANGE : EMERALD },
            ].map(({ label, value, color }) => (
              <View key={label} style={styles.modalInfoRow}>
                <Text style={styles.modalInfoLabel}>{label}</Text>
                <Text style={[styles.modalInfoValue, { color }]}>{value}</Text>
              </View>
            ))}
          </View>

          {/* Input */}
          <View style={styles.modalInputWrap}>
            <Text style={styles.modalInputLabel}>Payment Amount (₹)</Text>
            <View style={[
              styles.modalInputRow,
              isOver && { borderColor: RED, backgroundColor: `${RED}08` },
            ]}>
              <Text style={styles.modalRupee}>₹</Text>
              <TextInput
                ref={inputRef}
                style={styles.modalInput}
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                value={input}
                onChangeText={setInput}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                autoFocus
                editable={!submitting}
              />
            </View>
            {isOver && (
              <Text style={styles.modalInputError}>
                Cannot exceed remaining due ₹{safeFix(remaining, 2)}
              </Text>
            )}
          </View>

          {/* After-this-payment preview */}
          {entered > 0 && !isOver && (
            <View style={[
              styles.modalPreview,
              { backgroundColor: afterThis === 0 ? `${EMERALD}12` : `${ORANGE}10` },
            ]}>
              <Feather
                name={afterThis === 0 ? "check-circle" : "minus-circle"}
                size={14}
                color={afterThis === 0 ? EMERALD : ORANGE}
              />
              <Text style={[
                styles.modalPreviewText,
                { color: afterThis === 0 ? EMERALD : ORANGE },
              ]}>
                {afterThis === 0
                  ? "Fully paid after this payment"
                  : `₹${safeFix(afterThis, 2)} will still remain`}
              </Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.modalActions}>
            <Pressable
              style={({ pressed }) => [styles.modalCancelBtn, { opacity: pressed ? 0.7 : 1 }]}
              onPress={handleClose}
              disabled={submitting}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [{ opacity: pressed || !canSubmit ? 0.65 : 1, flex: 1 }]}
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              <LinearGradient
                colors={canSubmit ? [EMERALD, "#15803D"] : ["#9CA3AF", "#6B7280"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.modalSubmitBtn}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Feather name="check" size={16} color="#fff" />
                    <Text style={styles.modalSubmitText}>Confirm Payment</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const {
    members, expenses, payments, paymentsError, announcements, deleteAnnouncement,
    getMonthTotals, calculateAllMonthlyBills, markUnpaid, recordPayment,
    paymentSubmissions,
  } = useData();
  const { showToast } = useToast();
  const [month, setMonth] = useState(getCurrentMonth());
  const [payingIds, setPayingIds] = useState<Set<string>>(new Set());
  const [payError, setPayError] = useState<string | null>(null);
  const { refreshing, onRefresh } = useRefresh();

  // ── Sidebar ───────────────────────────────────────────────────────────────
  const [sidebarVisible, setSidebarVisible] = useState(false);

  // ── Payment modal ─────────────────────────────────────────────────────────
  const [payModal, setPayModal] = useState<{
    memberId: string;
    memberName: string;
    dueAmount: number;
    alreadyPaid: number;
  } | null>(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);

  const setMemberPaying = (id: string, paying: boolean) =>
    setPayingIds((prev) => { const n = new Set(prev); paying ? n.add(id) : n.delete(id); return n; });

  const { totalExpense, totalMeals, perMealCost } = getMonthTotals(month);
  const activeMembers = members.filter((m) => m.status === "active").length;
  const monthExpenses = expenses.filter((e) => e.date.startsWith(month));
  const rawExpense = monthExpenses.reduce((s, e) => s + e.amount, 0);

  const bills = calculateAllMonthlyBills(month);
  const totalDue    = bills.reduce((s, b) => s + b.dueAmount, 0);
  const totalCredit = bills.reduce((s, b) => s + b.creditBalance, 0);

  const getPayment = (memberId: string) =>
    payments.find((p) => p.memberId === memberId && p.month === month);

  const paidCount = bills.filter((b) => getPayment(b.memberId)?.paid === true).length;

  const todayLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long",
  });

  // Open the payment modal for a member
  const openPayModal = (memberId: string, memberName: string, dueAmount: number) => {
    const payment = getPayment(memberId);
    setPayModal({ memberId, memberName, dueAmount, alreadyPaid: payment?.amount ?? 0 });
  };

  // Submit a partial/full payment from the modal
  const handleModalSubmit = async (amount: number) => {
    if (!payModal) return;
    setModalSubmitting(true);
    setPayError(null);
    try {
      await recordPayment(payModal.memberId, month, amount, payModal.dueAmount);
      const isNowFull = (payModal.alreadyPaid + amount) >= payModal.dueAmount;
      showToast(
        isNowFull ? "Payment Complete 🎉" : "Payment Recorded",
        isNowFull
          ? `₹${safeFix(payModal.alreadyPaid + amount, 2)} — fully settled for ${monthLabel(month)}`
          : `₹${safeFix(amount, 2)} recorded · ₹${safeFix(payModal.dueAmount - payModal.alreadyPaid - amount, 2)} remaining`,
        isNowFull ? "success" : "warning",
      );
      setPayModal(null);
    } catch (err) {
      setPayError((err as Error).message || "Failed to record payment. Please try again.");
    } finally {
      setModalSubmitting(false);
    }
  };

  // Reset a member's payment to zero
  const handleResetPayment = (memberId: string, memberName: string) => {
    Alert.alert(
      "Reset Payment",
      `Remove all recorded payments for ${memberName} this month?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset", style: "destructive",
          onPress: async () => {
            setMemberPaying(memberId, true);
            try {
              await markUnpaid(memberId, month);
              showToast("Payment Reset", `${memberName}'s payment cleared for ${monthLabel(month)}`, "info");
            } catch (err) {
              setPayError((err as Error).message || "Failed to reset payment.");
            } finally {
              setMemberPaying(memberId, false);
            }
          },
        },
      ],
    );
  };

  return (
    <LinearGradient colors={BG} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.screen}>
      <ScreenHeader
        title="Dashboard"
        icon="home"
        subtitle={todayLabel}
        rightElement={
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={() => setSidebarVisible(true)} style={styles.headerBtn}>
              <Feather name="bell" size={18} color="rgba(255,255,255,0.9)" />
              {announcements.length > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>
                    {announcements.length > 9 ? "9+" : String(announcements.length)}
                  </Text>
                </View>
              )}
            </Pressable>
            <Pressable
              onPress={() => logout().then(() => router.replace("/"))}
              style={styles.headerBtn}
            >
              <Feather name="log-out" size={18} color="rgba(255,255,255,0.9)" />
            </Pressable>
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PRIMARY]} tintColor={PRIMARY} />
        }
      >
        {/* Month navigator */}
        <View style={[styles.monthNav, { backgroundColor: colors.card }]}>
          <Pressable onPress={() => setMonth(prevMonth(month))} style={styles.navArrow}>
            <Feather name="chevron-left" size={22} color={PRIMARY} />
          </Pressable>
          <Text style={[styles.monthText, { color: colors.foreground }]}>{monthLabel(month)}</Text>
          <Pressable onPress={() => setMonth(nextMonth(month))} style={styles.navArrow}>
            <Feather name="chevron-right" size={22} color={PRIMARY} />
          </Pressable>
        </View>

        {/* Stat cards */}
        <View style={styles.statsGrid}>
          <StatCard label="Active Members" value={String(activeMembers)} icon="users"    color="#4F46E5" />
          <StatCard label="Total Meals"    value={String(totalMeals)}    icon="grid"     color="#22D3EE" />
          <StatCard label="Expenses"       value={`₹${rawExpense.toFixed(0)}`} icon="dollar-sign" color="#FB923C" />
          <StatCard label="Per Meal Rate"  value={`₹${perMealCost.toFixed(1)}`} icon="trending-up" color="#34D399" />
        </View>

        {/* Error banner */}
        {paymentsError && (
          <View style={[styles.errorBanner, { backgroundColor: "#EF444415", borderColor: "#EF4444" }]}>
            <Feather name="alert-circle" size={16} color="#EF4444" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.errorBannerText, { color: "#EF4444", fontWeight: "700" }]}>
                bill_payments table not accessible
              </Text>
              <Text style={[styles.errorBannerText, { color: "#EF4444", fontSize: 11, marginTop: 2 }]}>
                {paymentsError}
              </Text>
            </View>
          </View>
        )}

        {payError && (
          <View style={[styles.errorBanner, { backgroundColor: "#EF444415", borderColor: "#EF4444" }]}>
            <Feather name="alert-circle" size={16} color="#EF4444" />
            <Text style={[styles.errorBannerText, { color: "#EF4444", flex: 1 }]}>{payError}</Text>
            <Pressable onPress={() => setPayError(null)}>
              <Feather name="x" size={16} color="#EF4444" />
            </Pressable>
          </View>
        )}

        {/* Payment status banner */}
        {bills.length > 0 && (
          <View style={[styles.paymentBanner, { backgroundColor: colors.card }]}>
            <View style={styles.paymentBannerLeft}>
              <Feather
                name="check-circle"
                size={20}
                color={paidCount === bills.length ? EMERALD : ORANGE}
              />
              <Text style={[styles.paymentBannerText, { color: colors.foreground }]}>
                {paidCount} / {bills.length} fully paid
              </Text>
            </View>
            <View style={[
              styles.paymentPill,
              { backgroundColor: paidCount === bills.length ? `${EMERALD}20` : `${ORANGE}20` },
            ]}>
              <Text style={[
                styles.paymentPillText,
                { color: paidCount === bills.length ? EMERALD : ORANGE },
              ]}>
                {paidCount === bills.length ? "All Settled" : "Pending"}
              </Text>
            </View>
          </View>
        )}

        {/* Monthly summary */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Monthly Summary</Text>
          {[
            ["Total Monthly Expense",   `₹${totalExpense.toFixed(0)}`,  colors.foreground],
            ["Total Meals Served",       String(totalMeals),             colors.foreground],
            ["Total Due from Members",   `₹${totalDue.toFixed(0)}`,     RED],
            ["Total Credit Balance",     `₹${totalCredit.toFixed(0)}`,  EMERALD],
          ].map(([key, val, clr], i) => (
            <View key={key}>
              {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryKey, { color: colors.mutedForeground }]}>{key}</Text>
                <Text style={[styles.summaryVal, { color: clr }]}>{val}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Payment Summary */}
        {(() => {
          const totalDue = bills.reduce((s, b) => s + b.dueAmount, 0);
          const totalPaid = bills.reduce((s, b) => {
            const p = getPayment(b.memberId);
            return s + (p?.amount ?? 0);
          }, 0);
          const paidFull = bills.filter((b) => {
            const p = getPayment(b.memberId);
            return p?.paid === true;
          }).length;
          const paidPartial = bills.filter((b) => {
            const p = getPayment(b.memberId);
            return !p?.paid && (p?.amount ?? 0) > 0;
          }).length;
          const pending = bills.filter((b) => {
            const p = getPayment(b.memberId);
            return !p?.paid && (p?.amount ?? 0) === 0;
          }).length;
          const pendingSubs = paymentSubmissions.filter((s) => s.status === "pending").length;
          return (
            <View style={[styles.section, { backgroundColor: colors.card }]}>
              <View style={styles.sectionTitleRow}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Payment Summary</Text>
                <Pressable
                  style={[styles.viewAllBtn, { backgroundColor: `${PRIMARY}12` }]}
                  onPress={() => router.navigate("/admin/payments")}
                >
                  <Feather name="credit-card" size={13} color={PRIMARY} />
                  <Text style={[styles.viewAllText, { color: PRIMARY }]}>Manage</Text>
                </Pressable>
              </View>

              {pendingSubs > 0 && (
                <Pressable
                  style={[styles.pendingAlert, { backgroundColor: `${ORANGE}12`, borderColor: `${ORANGE}30` }]}
                  onPress={() => router.navigate("/admin/payments")}
                >
                  <Feather name="clock" size={15} color={ORANGE} />
                  <Text style={[styles.pendingAlertText, { color: ORANGE }]}>
                    {pendingSubs} UPI payment{pendingSubs !== 1 ? "s" : ""} awaiting verification
                  </Text>
                  <Feather name="chevron-right" size={15} color={ORANGE} />
                </Pressable>
              )}

              <View style={styles.payOverviewRow}>
                {[
                  { label: "Fully Paid",  count: paidFull,    color: EMERALD },
                  { label: "Partial",     count: paidPartial, color: ORANGE  },
                  { label: "Not Paid",    count: pending,     color: RED     },
                ].map(({ label, count, color }) => (
                  <View key={label} style={[styles.payOverviewCard, { backgroundColor: `${color}10`, borderColor: `${color}25` }]}>
                    <Text style={[styles.payOverviewCount, { color }]}>{count}</Text>
                    <Text style={[styles.payOverviewLabel, { color: colors.mutedForeground }]}>{label}</Text>
                  </View>
                ))}
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryKey, { color: colors.mutedForeground }]}>Total Bill</Text>
                <Text style={[styles.summaryVal, { color: RED }]}>₹{safeFix(totalDue)}</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryKey, { color: colors.mutedForeground }]}>Collected (UPI)</Text>
                <Text style={[styles.summaryVal, { color: EMERALD }]}>₹{safeFix(totalPaid)}</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryKey, { color: colors.mutedForeground }]}>Still Outstanding</Text>
                <Text style={[styles.summaryVal, { color: ORANGE }]}>₹{safeFix(Math.max(0, totalDue - totalPaid))}</Text>
              </View>
            </View>
          );
        })()}

        {/* Recent expenses */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent Expenses</Text>
          {monthExpenses.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No expenses this month</Text>
          ) : monthExpenses.slice(-5).reverse().map((e) => (
            <View key={e.id}>
              <View style={styles.expenseRow}>
                <View style={[styles.expenseIcon, { backgroundColor: `${PRIMARY}18` }]}>
                  <Feather name="shopping-bag" size={16} color={PRIMARY} />
                </View>
                <View style={styles.expenseInfo}>
                  <Text style={[styles.expenseName, { color: colors.foreground }]}>
                    {e.type.charAt(0).toUpperCase() + e.type.slice(1)}{e.shopName ? ` · ${e.shopName}` : ""}
                  </Text>
                  <Text style={[styles.expenseDate, { color: colors.mutedForeground }]}>{e.date}</Text>
                </View>
                <Text style={[styles.expenseAmount, { color: colors.foreground }]}>₹{e.amount}</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
            </View>
          ))}
        </View>
      </ScrollView>

      {/* ── Announcement Sidebar ── */}
      {sidebarVisible && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <View style={styles.backdrop} pointerEvents="auto">
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setSidebarVisible(false)} />
          </View>
          <View style={[styles.sidebar, { backgroundColor: colors.card, paddingTop: insets.top }]} pointerEvents="auto">
            <View style={styles.sidebarHeader}>
              <View style={styles.sidebarTitleRow}>
                <View style={[styles.sidebarIconWrap, { backgroundColor: `${PRIMARY}18` }]}>
                  <Feather name="bell" size={18} color={PRIMARY} />
                </View>
                <Text style={[styles.sidebarTitle, { color: colors.foreground }]}>Announcements</Text>
              </View>
              <Pressable onPress={() => setSidebarVisible(false)} style={styles.sidebarClose}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <View style={[styles.sidebarDivider, { backgroundColor: colors.border }]} />
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
              {announcements.length === 0 ? (
                <View style={styles.sidebarEmpty}>
                  <Feather name="bell-off" size={40} color={colors.mutedForeground} />
                  <Text style={[styles.sidebarEmptyText, { color: colors.mutedForeground }]}>No announcements yet</Text>
                  <Text style={[styles.sidebarEmptyHint, { color: colors.mutedForeground }]}>Post one from More → News</Text>
                </View>
              ) : announcements.map((a) => (
                <View key={a.id} style={[styles.annCard, { backgroundColor: colors.background }]}>
                  <View style={styles.annCardHeader}>
                    <Text style={[styles.annCardTitle, { color: colors.foreground }]} numberOfLines={2}>{a.title}</Text>
                    <Pressable
                      onPress={() => Alert.alert("Delete", `Remove "${a.title}"?`, [
                        { text: "Cancel", style: "cancel" },
                        { text: "Delete", style: "destructive", onPress: async () => {
                          try { await deleteAnnouncement(a.id); }
                          catch (err) { Alert.alert("Error", (err as Error).message); }
                        }},
                      ])}
                      style={{ padding: 4 }}
                    >
                      <Feather name="trash-2" size={15} color="#EF4444" />
                    </Pressable>
                  </View>
                  <Text style={[styles.annCardBody, { color: colors.mutedForeground }]}>{a.body}</Text>
                  <View style={styles.annCardFooter}>
                    <Feather name="clock" size={11} color={PRIMARY} />
                    <Text style={styles.annCardDate}>
                      {new Date(a.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {/* ── Payment Modal ── */}
      {payModal && (
        <PaymentModal
          visible={!!payModal}
          memberName={payModal.memberName}
          dueAmount={payModal.dueAmount}
          alreadyPaid={payModal.alreadyPaid}
          submitting={modalSubmitting}
          onClose={() => setPayModal(null)}
          onSubmit={handleModalSubmit}
        />
      )}
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerBtn: {
    padding: 10, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
  },
  bellBadge: {
    position: "absolute", top: 4, right: 4,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: "#EF4444",
    alignItems: "center", justifyContent: "center", paddingHorizontal: 3,
  },
  bellBadgeText: { fontSize: 9, fontWeight: "800", color: "#fff" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  sidebar: {
    position: "absolute", right: 0, top: 0, bottom: 0, width: SIDEBAR_WIDTH,
    shadowColor: "#000", shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.18, shadowRadius: 20, elevation: 24,
  },
  sidebarHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 18, paddingVertical: 16,
  },
  sidebarTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  sidebarIconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  sidebarTitle: { fontSize: 18, fontWeight: "800" },
  sidebarClose: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  sidebarDivider: { height: 1, marginHorizontal: 16 },
  sidebarEmpty: { alignItems: "center", paddingTop: 60, gap: 12 },
  sidebarEmptyText: { fontSize: 15, fontWeight: "600" },
  sidebarEmptyHint: { fontSize: 12 },
  annCard: { borderRadius: 16, padding: 14, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: PRIMARY },
  annCardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 6 },
  annCardTitle: { flex: 1, fontSize: 14, fontWeight: "700", lineHeight: 20 },
  annCardBody: { fontSize: 13, lineHeight: 19, marginBottom: 8 },
  annCardFooter: { flexDirection: "row", alignItems: "center", gap: 4 },
  annCardDate: { fontSize: 11, fontWeight: "600", color: PRIMARY },

  monthNav: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginHorizontal: 20, marginTop: 16, marginBottom: 16, borderRadius: 16, padding: 8,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.6)",
    shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10, shadowRadius: 14, elevation: 4,
  },
  navArrow: { padding: 8 },
  monthText: { fontSize: 17, fontWeight: "700" },

  statsGrid: {
    flexDirection: "row", flexWrap: "wrap",
    paddingHorizontal: 20, gap: 12, marginBottom: 16,
  },
  statCard: {
    width: "47%", borderRadius: 20, overflow: "hidden",
    shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22, shadowRadius: 12, elevation: 8,
  },
  statCardInner: { padding: 18, gap: 6 },
  statIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  statValue: { fontSize: 24, fontWeight: "800", textAlign: "center", width: "100%" },
  statLabel: { fontSize: 12, textAlign: "center", width: "100%" },

  paymentBanner: {
    marginHorizontal: 20, marginBottom: 16, borderRadius: 20, padding: 18,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.6)",
    shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10, shadowRadius: 16, elevation: 6,
  },
  paymentBannerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  paymentBannerText: { fontSize: 14, fontWeight: "600" },
  paymentPill: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  paymentPillText: { fontSize: 12, fontWeight: "700" },

  section: {
    marginHorizontal: 20, marginBottom: 16, borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.6)",
    shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10, shadowRadius: 16, elevation: 6,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 14 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  viewAllBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  viewAllText: { fontSize: 13, fontWeight: "700" },
  pendingAlert: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, padding: 12, borderWidth: 1, marginBottom: 14 },
  pendingAlertText: { fontSize: 13, fontWeight: "600", flex: 1 },
  payOverviewRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  payOverviewCard: { flex: 1, borderRadius: 14, padding: 12, borderWidth: 1, alignItems: "center" },
  payOverviewCount: { fontSize: 24, fontWeight: "900", marginBottom: 2 },
  payOverviewLabel: { fontSize: 11, fontWeight: "600" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
  summaryKey: { fontSize: 14 },
  summaryVal: { fontSize: 14, fontWeight: "600" },
  divider: { height: 1, marginVertical: 2 },

  memberBillRow: { flexDirection: "row", alignItems: "center", paddingTop: 10, gap: 12 },
  memberBillInfo: { flex: 1 },
  memberBillName: { fontSize: 15, fontWeight: "600" },
  memberBillSub: { fontSize: 12, marginTop: 2 },
  memberBillRight: { alignItems: "flex-end" },
  memberBillAmount: { fontSize: 16, fontWeight: "700" },
  memberBillStatus: { fontSize: 11, marginTop: 2 },

  payStatusRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  statusBadgeText: { fontSize: 12, fontWeight: "600" },
  progressTrack: {
    flex: 1, height: 4, borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.08)", overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 2 },

  paymentRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  recordBtnWrap: { flex: 1 },
  actionBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    justifyContent: "center",
  },
  actionBtnText: { fontSize: 13, fontWeight: "700" },
  resetBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8,
  },

  expenseRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 12 },
  expenseIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  expenseInfo: { flex: 1 },
  expenseName: { fontSize: 14, fontWeight: "600" },
  expenseDate: { fontSize: 11, marginTop: 2 },
  expenseAmount: { fontSize: 15, fontWeight: "700" },
  emptyText: { fontSize: 14, textAlign: "center", paddingVertical: 12 },
  errorBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    marginHorizontal: 20, marginBottom: 12,
    borderRadius: 16, padding: 14, borderWidth: 1,
  },
  errorBannerText: { fontSize: 13 },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 36,
    shadowColor: "#000", shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 24,
  },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  modalHeaderIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#111827" },
  modalSub: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  modalClose: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#F3F4F6" },

  modalInfoBlock: {
    backgroundColor: "#F9FAFB", borderRadius: 16,
    padding: 16, gap: 10, marginBottom: 20,
  },
  modalInfoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalInfoLabel: { fontSize: 13, color: "#6B7280", fontWeight: "500" },
  modalInfoValue: { fontSize: 14, fontWeight: "700" },

  modalInputWrap: { marginBottom: 12 },
  modalInputLabel: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 8 },
  modalInputRow: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: "#F9FAFB",
  },
  modalRupee: { fontSize: 20, fontWeight: "700", color: "#374151", marginRight: 4 },
  modalInput: { flex: 1, fontSize: 24, fontWeight: "700", color: "#111827" },
  modalInputError: { fontSize: 12, color: RED, marginTop: 6, marginLeft: 4 },

  modalPreview: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 12, padding: 12, marginBottom: 12,
  },
  modalPreviewText: { fontSize: 13, fontWeight: "600" },

  modalActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  modalCancelBtn: {
    paddingHorizontal: 20, paddingVertical: 14, borderRadius: 16,
    backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center",
  },
  modalCancelText: { fontSize: 14, fontWeight: "700", color: "#374151" },
  modalSubmitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, borderRadius: 16, paddingVertical: 14,
  },
  modalSubmitText: { fontSize: 15, fontWeight: "800", color: "#fff" },
});
