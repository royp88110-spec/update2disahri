import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import { ScreenHeader } from "@/components/ScreenHeader";
import { MemberAvatar } from "@/components/MemberAvatar";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useData } from "@/context/DataContext";
import type { PaymentSubmission } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";
import { useRefresh } from "@/hooks/useRefresh";

// ── Helpers ───────────────────────────────────────────────────────────────────
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
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const PRIMARY = "#4F46E5";
const EMERALD = "#34D399";
const ORANGE  = "#FB923C";
const RED     = "#F43F5E";

type PaymentFilter = "all" | "pending" | "approved" | "rejected";

// ── AdminPaymentsScreen ───────────────────────────────────────────────────────
export default function AdminPaymentsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    members,
    upiSettings, paymentSubmissions,
    saveUpiSettings, approvePaymentSubmission, rejectPaymentSubmission,
    calculateAllMonthlyBills, calculateMonthlyBill, payments, recordCashPayment,
  } = useData();
  const { refreshing, onRefresh } = useRefresh();

  const [month, setMonth] = useState(getCurrentMonth());
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("pending");

  // Verify modal
  const [verifyModal, setVerifyModal] = useState(false);
  const [verifyingSub, setVerifyingSub] = useState<PaymentSubmission | null>(null);
  const [approvedAmountInput, setApprovedAmountInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [rejectNotesInput, setRejectNotesInput] = useState("");
  const [showRejectNotes, setShowRejectNotes] = useState(false);

  // Screenshot
  const [screenshotModalVisible, setScreenshotModalVisible] = useState(false);
  const [fullScreenshot, setFullScreenshot] = useState<string | null>(null);

  // Cash payment modal
  const [cashModal, setCashModal] = useState(false);
  const [cashMemberId, setCashMemberId] = useState("");
  const [cashMonth, setCashMonth] = useState(getCurrentMonth());
  const [cashAmount, setCashAmount] = useState("");
  const [cashNote, setCashNote] = useState("");
  const [isSavingCash, setIsSavingCash] = useState(false);

  // UPI Settings form
  const [upiForm, setUpiForm] = useState({ upiId: "", accountHolderName: "", paymentNote: "" });
  const [upiQrBase64, setUpiQrBase64] = useState<string | null>(null);
  const [isSavingUpi, setIsSavingUpi] = useState(false);

  // Sync UPI form when settings load
  useEffect(() => {
    if (upiSettings) {
      setUpiForm({
        upiId: upiSettings.upiId,
        accountHolderName: upiSettings.accountHolderName,
        paymentNote: upiSettings.paymentNote ?? "",
      });
      setUpiQrBase64(upiSettings.qrCodeBase64);
    }
  }, [upiSettings]);

  const getMemberName = (id: string) => members.find((m) => m.id === id)?.name ?? "Unknown";

  // ── Submission filters (scoped to selected month) ─────────────────────────
  const monthSubmissions = paymentSubmissions.filter((s) => s.month === month);
  const pendingCount = monthSubmissions.filter((s) => s.status === "pending").length;
  const filteredSubmissions = paymentFilter === "all"
    ? monthSubmissions
    : monthSubmissions.filter((s) => s.status === paymentFilter);

  // ── Payment summary for current month ─────────────────────────────────────
  const bills = calculateAllMonthlyBills(month);
  const totalDue = bills.reduce((s, b) => s + b.dueAmount, 0);
  const totalCollected = bills.reduce((s, b) => {
    const p = payments.find((p) => p.memberId === b.memberId && p.month === month);
    return s + (p?.amount ?? 0);
  }, 0);
  const approvedThisMonth = paymentSubmissions
    .filter((s) => s.month === month && s.status === "approved")
    .reduce((s, sub) => s + (sub.approvedAmount ?? 0), 0);

  // ── Actions ───────────────────────────────────────────────────────────────
  const openVerifyModal = (sub: PaymentSubmission) => {
    setVerifyingSub(sub);
    setApprovedAmountInput(String(sub.claimedAmount));
    setRejectNotesInput("");
    setShowRejectNotes(false);
    setVerifyModal(true);
  };

  const handleApprove = async () => {
    if (!verifyingSub) return;
    const amount = parseFloat(approvedAmountInput);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid approved amount.");
      return;
    }
    setIsProcessing(true);
    try {
      await approvePaymentSubmission(verifyingSub.id, amount);
      setVerifyModal(false);
    } catch (err) {
      Alert.alert("Approval Failed", (err as Error).message || "Could not approve payment.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!verifyingSub) return;
    setIsProcessing(true);
    try {
      await rejectPaymentSubmission(verifyingSub.id, rejectNotesInput.trim() || undefined);
      setVerifyModal(false);
    } catch (err) {
      Alert.alert("Rejection Failed", (err as Error).message || "Could not reject payment.");
    } finally {
      setIsProcessing(false);
    }
  };

  // ── UPI Settings ──────────────────────────────────────────────────────────
  const pickQrCode = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission Required", "Please allow access to your photos."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.7, base64: true });
    if (!result.canceled && result.assets[0]?.base64) { setUpiQrBase64(result.assets[0].base64); }
  };

  const saveUpi = async () => {
    if (!upiForm.upiId.trim()) return Alert.alert("Validation Error", "UPI ID is required.");
    if (!upiForm.accountHolderName.trim()) return Alert.alert("Validation Error", "Account Holder Name is required.");
    setIsSavingUpi(true);
    try {
      await saveUpiSettings({ upiId: upiForm.upiId.trim(), accountHolderName: upiForm.accountHolderName.trim(), qrCodeBase64: upiQrBase64, paymentNote: upiForm.paymentNote.trim() || null });
    } catch (err) {
      Alert.alert("Save Failed", (err as Error).message || "Could not save UPI settings.");
    } finally {
      setIsSavingUpi(false);
    }
  };

  // ── Cash Payment ──────────────────────────────────────────────────────────
  const openCashModal = () => {
    setCashMemberId("");
    setCashMonth(month);
    setCashAmount("");
    setCashNote("");
    setCashModal(true);
  };

  const handleSaveCash = async () => {
    if (!cashMemberId) {
      Alert.alert("Select Member", "Please select a member.");
      return;
    }
    const amount = parseFloat(cashAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount.");
      return;
    }
    setIsSavingCash(true);
    try {
      const bill = calculateMonthlyBill(cashMemberId, cashMonth);
      await recordCashPayment(cashMemberId, cashMonth, amount, cashNote.trim() || undefined);
      setCashModal(false);
      Alert.alert("Recorded", `Cash payment of ₹${amount.toFixed(2)} recorded for ${members.find((m) => m.id === cashMemberId)?.name ?? "member"}.`);
    } catch (err) {
      Alert.alert("Failed", (err as Error).message || "Could not record cash payment.");
    } finally {
      setIsSavingCash(false);
    }
  };

  // ── Status helpers ─────────────────────────────────────────────────────────
  const statusColor = (s: string) => s === "pending" ? ORANGE : s === "approved" ? EMERALD : RED;
  const statusLabel = (s: string) => s === "pending" ? "Pending" : s === "approved" ? "Approved" : "Rejected";
  const statusIcon = (s: string): React.ComponentProps<typeof Feather>["name"] =>
    s === "pending" ? "clock" : s === "approved" ? "check-circle" : "x-circle";

  const REFRESH = <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PRIMARY]} tintColor={PRIMARY} />;

  return (
    <LinearGradient colors={["#7DE7D8", "#B7F5E7", "#DDF5FF"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.screen}>
      <ScreenHeader
        title="Payments"
        icon="credit-card"
        subtitle="Review · Approve · Configure"
        bottomElement={
          <View style={styles.monthNav}>
            <Pressable onPress={() => setMonth(prevMonth(month))} style={styles.navArrow}>
              <Feather name="chevron-left" size={20} color="rgba(255,255,255,0.9)" />
            </Pressable>
            <Text style={styles.monthText}>{monthLabel(month)}</Text>
            <Pressable onPress={() => setMonth(nextMonth(month))} style={styles.navArrow}>
              <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.9)" />
            </Pressable>
          </View>
        }
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
        refreshControl={REFRESH}
      >
        {/* ── Month Summary ─────────────────────────────────────────────────── */}
        <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.summaryTitle, { color: colors.foreground }]}>
            {monthLabel(month)} Summary
          </Text>
          {[
            { label: "Total Bill",    val: `₹${totalDue.toFixed(0)}`,       color: RED    },
            { label: "UPI Collected", val: `₹${approvedThisMonth.toFixed(0)}`, color: EMERALD },
            { label: "Still Pending", val: `₹${Math.max(0, totalDue - totalCollected).toFixed(0)}`, color: ORANGE },
          ].map(({ label, val, color }) => (
            <View key={label} style={[styles.summaryRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.summaryKey, { color: colors.mutedForeground }]}>{label}</Text>
              <Text style={[styles.summaryVal, { color }]}>{val}</Text>
            </View>
          ))}
        </View>

        {/* ── Pending alert ─────────────────────────────────────────────────── */}
        {pendingCount > 0 && (
          <View style={[styles.pendingAlert, { backgroundColor: `${ORANGE}12`, borderColor: `${ORANGE}30` }]}>
            <Feather name="clock" size={18} color={ORANGE} />
            <Text style={[styles.pendingAlertText, { color: ORANGE }]}>
              {pendingCount} payment{pendingCount !== 1 ? "s" : ""} awaiting verification
            </Text>
          </View>
        )}

        {/* ── Record Cash Payment ───────────────────────────────────────────── */}
        <Pressable
          style={({ pressed }) => [styles.cashBtn, { backgroundColor: colors.card, opacity: pressed ? 0.85 : 1 }]}
          onPress={openCashModal}
        >
          <View style={[styles.cashBtnIcon, { backgroundColor: `${EMERALD}15` }]}>
            <Feather name="plus-circle" size={18} color={EMERALD} />
          </View>
          <Text style={[styles.cashBtnText, { color: colors.foreground }]}>Record Cash Payment</Text>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </Pressable>

        {/* ── Filter chips ──────────────────────────────────────────────────── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          <View style={styles.filterRow}>
            {(["pending", "approved", "rejected", "all"] as PaymentFilter[]).map((f) => (
              <Pressable
                key={f}
                style={[styles.filterChip, paymentFilter === f && { backgroundColor: PRIMARY }]}
                onPress={() => setPaymentFilter(f)}
              >
                {f === "pending" && pendingCount > 0 && paymentFilter !== "pending" && (
                  <View style={styles.chipBadge}><Text style={styles.chipBadgeText}>{pendingCount}</Text></View>
                )}
                <Text style={[styles.filterChipText, { color: paymentFilter === f ? "#fff" : colors.mutedForeground }]}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* ── Payment cards ─────────────────────────────────────────────────── */}
        {filteredSubmissions.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="inbox" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No {paymentFilter === "all" ? "" : paymentFilter} payments
            </Text>
          </View>
        ) : filteredSubmissions.map((sub) => {
          const sc = statusColor(sub.status);
          return (
            <View key={sub.id} style={[styles.payCard, { backgroundColor: colors.card }]}>
              <View style={styles.payCardHeader}>
                <MemberAvatar name={getMemberName(sub.memberId)} size={44} bgColor={`${sc}18`} textColor={sc} />
                <View style={styles.payCardInfo}>
                  <Text style={[styles.payCardName, { color: colors.foreground }]}>{getMemberName(sub.memberId)}</Text>
                  <Text style={[styles.payCardSub, { color: colors.mutedForeground }]}>
                    {monthLabel(sub.month)} · {fmtDate(sub.submittedAt)}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: `${sc}18` }]}>
                  <Feather name={statusIcon(sub.status)} size={12} color={sc} />
                  <Text style={[styles.statusBadgeText, { color: sc }]}>{statusLabel(sub.status)}</Text>
                </View>
              </View>

              <View style={[styles.payCardDivider, { backgroundColor: colors.border }]} />

              <View style={styles.payDetails}>
                <View style={styles.payDetailRow}>
                  <Text style={[styles.payDetailLabel, { color: colors.mutedForeground }]}>Claimed</Text>
                  <Text style={[styles.payDetailVal, { color: colors.foreground }]}>₹{sub.claimedAmount.toFixed(2)}</Text>
                </View>
                {sub.approvedAmount != null && (
                  <View style={styles.payDetailRow}>
                    <Text style={[styles.payDetailLabel, { color: colors.mutedForeground }]}>Approved</Text>
                    <Text style={[styles.payDetailVal, { color: EMERALD, fontWeight: "700" }]}>₹{sub.approvedAmount.toFixed(2)}</Text>
                  </View>
                )}
                {sub.utr ? (
                  <View style={styles.payDetailRow}>
                    <Text style={[styles.payDetailLabel, { color: colors.mutedForeground }]}>UTR / Txn ID</Text>
                    <Text style={[styles.payDetailVal, { color: colors.foreground }]}>{sub.utr}</Text>
                  </View>
                ) : sub.paymentMethod === "cash" ? (
                  <View style={styles.payDetailRow}>
                    <Text style={[styles.payDetailLabel, { color: colors.mutedForeground }]}>Payment Method</Text>
                    <Text style={[styles.payDetailVal, { color: colors.foreground }]}>Cash</Text>
                  </View>
                ) : null}
                {sub.adminNotes ? (
                  <View style={styles.payDetailRow}>
                    <Text style={[styles.payDetailLabel, { color: colors.mutedForeground }]}>Note</Text>
                    <Text style={[styles.payDetailVal, { color: colors.mutedForeground }]}>{sub.adminNotes}</Text>
                  </View>
                ) : null}
              </View>

              {sub.screenshotBase64 && (
                <Pressable
                  onPress={() => { setFullScreenshot(sub.screenshotBase64); setScreenshotModalVisible(true); }}
                  style={styles.thumbWrap}
                >
                  <Image source={{ uri: `data:image/jpeg;base64,${sub.screenshotBase64}` }} style={styles.thumb} resizeMode="cover" />
                  <View style={styles.thumbOverlay}>
                    <Feather name="maximize-2" size={16} color="#fff" />
                    <Text style={styles.thumbLabel}>View Screenshot</Text>
                  </View>
                </Pressable>
              )}

              {sub.status === "pending" && (
                <View style={[styles.payActions, { borderTopColor: colors.border }]}>
                  <Pressable style={[styles.payActionBtn, { backgroundColor: `${EMERALD}12` }]} onPress={() => openVerifyModal(sub)}>
                    <Feather name="check-circle" size={16} color={EMERALD} />
                    <Text style={[styles.payActionText, { color: EMERALD }]}>Verify & Approve</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.payActionBtn, { backgroundColor: `${RED}12` }]}
                    onPress={() => {
                      setVerifyingSub(sub);
                      setShowRejectNotes(true);
                      setRejectNotesInput("");
                      setVerifyModal(true);
                      setApprovedAmountInput(String(sub.claimedAmount));
                    }}
                  >
                    <Feather name="x-circle" size={16} color={RED} />
                    <Text style={[styles.payActionText, { color: RED }]}>Reject</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}

        {/* ── UPI Settings ──────────────────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 28, marginBottom: 16 }]}>
          UPI Settings
        </Text>

        <View style={[styles.upiCard, { backgroundColor: colors.card }]}>
          <View style={styles.upiCardHeader}>
            <View style={[styles.upiCardIcon, { backgroundColor: "#7C3AED15" }]}>
              <Feather name="send" size={18} color="#7C3AED" />
            </View>
            <View>
              <Text style={[styles.upiCardTitle, { color: colors.foreground }]}>UPI Payment Settings</Text>
              <Text style={[styles.upiCardDesc, { color: colors.mutedForeground }]}>Members pay using this UPI ID / QR</Text>
            </View>
          </View>

          {[
            { label: "UPI ID *", key: "upiId", placeholder: "e.g. dishari@upi", autoCapitalize: "none" as const },
            { label: "Account Holder Name *", key: "accountHolderName", placeholder: "e.g. Dishari Mess Admin", autoCapitalize: "words" as const },
            { label: "Payment Note (optional)", key: "paymentNote", placeholder: "e.g. Mess bill — Jul 2026", autoCapitalize: "sentences" as const },
          ].map(({ label, key, placeholder, autoCapitalize }) => (
            <View key={key} style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>{label}</Text>
              <TextInput
                style={[styles.formInput, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]}
                value={(upiForm as Record<string, string>)[key]}
                onChangeText={(v) => setUpiForm((f) => ({ ...f, [key]: v }))}
                placeholder={placeholder}
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize={autoCapitalize}
              />
            </View>
          ))}

          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>QR Code (optional)</Text>
            {upiQrBase64 ? (
              <View style={{ alignItems: "center" }}>
                <Image source={{ uri: `data:image/jpeg;base64,${upiQrBase64}` }} style={styles.qrPreview} resizeMode="contain" />
                <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                  <Pressable style={[styles.qrBtn, { backgroundColor: `${PRIMARY}12`, borderColor: `${PRIMARY}25` }]} onPress={pickQrCode}>
                    <Feather name="refresh-cw" size={14} color={PRIMARY} />
                    <Text style={[styles.qrBtnText, { color: PRIMARY }]}>Change</Text>
                  </Pressable>
                  <Pressable style={[styles.qrBtn, { backgroundColor: `${RED}12`, borderColor: `${RED}25` }]} onPress={() => setUpiQrBase64(null)}>
                    <Feather name="trash-2" size={14} color={RED} />
                    <Text style={[styles.qrBtnText, { color: RED }]}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable style={[styles.qrPicker, { borderColor: colors.border, backgroundColor: colors.muted }]} onPress={pickQrCode}>
                <Feather name="image" size={22} color={colors.mutedForeground} />
                <Text style={[styles.qrPickerText, { color: colors.mutedForeground }]}>Upload QR Code Image</Text>
              </Pressable>
            )}
          </View>

          <Pressable style={({ pressed }) => [{ opacity: (pressed || isSavingUpi) ? 0.75 : 1, marginTop: 4 }]} onPress={saveUpi} disabled={isSavingUpi}>
            <LinearGradient colors={["#7C3AED", PRIMARY]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saveBtn}>
              {isSavingUpi ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="save" size={16} color="#fff" />}
              <Text style={styles.saveBtnText}>{isSavingUpi ? "Saving…" : "Save UPI Settings"}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </ScrollView>

      {/* ── Cash Payment Modal ────────────────────────────────────────────────── */}
      <Modal visible={cashModal} animationType="slide" transparent statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <ScrollView style={{ width: "100%" }} contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }} keyboardShouldPersistTaps="handled">
            <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <View>
                  <Text style={[styles.modalTitle, { color: colors.foreground }]}>Record Cash Payment</Text>
                  <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>Auto-approved · No screenshot needed</Text>
                </View>
                <Pressable onPress={() => setCashModal(false)} hitSlop={10}>
                  <Feather name="x" size={22} color={colors.mutedForeground} />
                </Pressable>
              </View>

              {/* Member picker */}
              <Text style={[styles.formLabel, { color: colors.mutedForeground, marginBottom: 8 }]}>MEMBER</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {members.filter((m) => m.status === "active").map((m) => (
                    <Pressable
                      key={m.id}
                      onPress={() => setCashMemberId(m.id)}
                      style={[
                        styles.cashMemberChip,
                        cashMemberId === m.id
                          ? { backgroundColor: EMERALD, borderColor: EMERALD }
                          : { backgroundColor: colors.muted, borderColor: colors.border },
                      ]}
                    >
                      <Text style={[styles.cashMemberChipText, { color: cashMemberId === m.id ? "#fff" : colors.foreground }]}>
                        {m.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>

              {/* Month picker */}
              <Text style={[styles.formLabel, { color: colors.mutedForeground, marginBottom: 8 }]}>MONTH</Text>
              <View style={[styles.cashMonthRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Pressable onPress={() => setCashMonth(prevMonth(cashMonth))} style={styles.navArrow}>
                  <Feather name="chevron-left" size={20} color={colors.foreground} />
                </Pressable>
                <Text style={[styles.cashMonthText, { color: colors.foreground }]}>{monthLabel(cashMonth)}</Text>
                <Pressable onPress={() => setCashMonth(nextMonth(cashMonth))} style={styles.navArrow}>
                  <Feather name="chevron-right" size={20} color={colors.foreground} />
                </Pressable>
              </View>

              {/* Amount */}
              <View style={[styles.formGroup, { marginTop: 16 }]}>
                <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>AMOUNT (₹)</Text>
                <TextInput
                  style={[styles.approveInput, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]}
                  value={cashAmount}
                  onChangeText={setCashAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>

              {/* Note */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>NOTE (OPTIONAL)</Text>
                <TextInput
                  style={[styles.formInput, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]}
                  value={cashNote}
                  onChangeText={setCashNote}
                  placeholder="e.g. Paid in hand"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="sentences"
                />
              </View>

              {/* Payment method pill */}
              <View style={[styles.cashMethodPill, { backgroundColor: `${EMERALD}12`, borderColor: `${EMERALD}30` }]}>
                <Feather name="check-circle" size={14} color={EMERALD} />
                <Text style={[styles.cashMethodPillText, { color: EMERALD }]}>Payment Method: Cash · Approved Instantly</Text>
              </View>

              <Pressable style={({ pressed }) => [{ opacity: (pressed || isSavingCash) ? 0.75 : 1, marginBottom: 12 }]} onPress={handleSaveCash} disabled={isSavingCash}>
                <LinearGradient colors={[EMERALD, "#10B981"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saveBtn}>
                  {isSavingCash ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="check" size={18} color="#fff" />}
                  <Text style={styles.saveBtnText}>{isSavingCash ? "Saving…" : "Record Cash Payment"}</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Verify / Reject Modal ─────────────────────────────────────────────── */}
      <Modal visible={verifyModal} animationType="slide" transparent statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <ScrollView style={{ width: "100%" }} contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }} keyboardShouldPersistTaps="handled">
            <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <View>
                  <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                    {showRejectNotes ? "Reject Payment" : "Verify Payment"}
                  </Text>
                  {verifyingSub && (
                    <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
                      {getMemberName(verifyingSub.memberId)} · {monthLabel(verifyingSub.month)}
                    </Text>
                  )}
                </View>
                <Pressable onPress={() => { setVerifyModal(false); setShowRejectNotes(false); }} hitSlop={10}>
                  <Feather name="x" size={22} color={colors.mutedForeground} />
                </Pressable>
              </View>

              {verifyingSub && (
                <>
                  {verifyingSub.screenshotBase64 && (
                    <Pressable onPress={() => { setFullScreenshot(verifyingSub.screenshotBase64); setScreenshotModalVisible(true); }} style={styles.verifyThumbWrap}>
                      <Image source={{ uri: `data:image/jpeg;base64,${verifyingSub.screenshotBase64}` }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                      <View style={styles.thumbOverlay}>
                        <Feather name="maximize-2" size={14} color="#fff" />
                        <Text style={styles.thumbLabel}>View Full</Text>
                      </View>
                    </Pressable>
                  )}

                  <View style={[styles.verifyDetails, { backgroundColor: colors.muted }]}>
                    {[
                      { label: "Member", val: getMemberName(verifyingSub.memberId) },
                      { label: "Claimed Amount", val: `₹${verifyingSub.claimedAmount.toFixed(2)}` },
                      ...(verifyingSub.utr ? [{ label: "UTR / Txn ID", val: verifyingSub.utr }] : []),
                    ].map(({ label, val }) => (
                      <View key={label} style={styles.verifyDetailRow}>
                        <Text style={[styles.payDetailLabel, { color: colors.mutedForeground }]}>{label}</Text>
                        <Text style={[styles.payDetailVal, { color: colors.foreground }]}>{val}</Text>
                      </View>
                    ))}
                  </View>

                  {!showRejectNotes ? (
                    <>
                      <View style={styles.formGroup}>
                        <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>APPROVED AMOUNT (₹)</Text>
                        <TextInput
                          style={[styles.approveInput, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]}
                          value={approvedAmountInput}
                          onChangeText={setApprovedAmountInput}
                          keyboardType="decimal-pad"
                          placeholder={String(verifyingSub.claimedAmount)}
                          placeholderTextColor={colors.mutedForeground}
                          autoFocus
                        />
                        {approvedAmountInput !== "" && !isNaN(parseFloat(approvedAmountInput)) && (
                          <View style={[styles.amountHint, { backgroundColor: parseFloat(approvedAmountInput) < verifyingSub.claimedAmount ? `${ORANGE}15` : `${EMERALD}15` }]}>
                            <Text style={{ fontSize: 12, fontWeight: "600", color: parseFloat(approvedAmountInput) < verifyingSub.claimedAmount ? ORANGE : EMERALD }}>
                              {parseFloat(approvedAmountInput) < verifyingSub.claimedAmount
                                ? `Partial — ₹${(verifyingSub.claimedAmount - parseFloat(approvedAmountInput)).toFixed(2)} less than claimed`
                                : "Full claimed amount approved"}
                            </Text>
                          </View>
                        )}
                      </View>

                      <Pressable style={({ pressed }) => [{ opacity: (pressed || isProcessing) ? 0.75 : 1, marginBottom: 12 }]} onPress={handleApprove} disabled={isProcessing}>
                        <LinearGradient colors={[EMERALD, "#10B981"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saveBtn}>
                          {isProcessing ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="check" size={18} color="#fff" />}
                          <Text style={styles.saveBtnText}>{isProcessing ? "Approving…" : "Confirm Approval"}</Text>
                        </LinearGradient>
                      </Pressable>

                      <Pressable style={[styles.rejectOutline, { borderColor: RED }]} onPress={() => setShowRejectNotes(true)}>
                        <Feather name="x-circle" size={16} color={RED} />
                        <Text style={[styles.rejectOutlineText, { color: RED }]}>Reject Instead</Text>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <View style={styles.formGroup}>
                        <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>REJECTION REASON (OPTIONAL)</Text>
                        <TextInput
                          style={[styles.formInput, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border, minHeight: 80, textAlignVertical: "top" }]}
                          value={rejectNotesInput}
                          onChangeText={setRejectNotesInput}
                          placeholder="e.g. UTR not matching, please resubmit"
                          placeholderTextColor={colors.mutedForeground}
                          multiline
                          numberOfLines={3}
                          autoFocus
                        />
                      </View>

                      <Pressable style={({ pressed }) => [{ opacity: (pressed || isProcessing) ? 0.75 : 1, marginBottom: 12 }]} onPress={handleReject} disabled={isProcessing}>
                        <LinearGradient colors={[RED, "#E11D48"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saveBtn}>
                          {isProcessing ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="x" size={18} color="#fff" />}
                          <Text style={styles.saveBtnText}>{isProcessing ? "Rejecting…" : "Confirm Rejection"}</Text>
                        </LinearGradient>
                      </Pressable>

                      <Pressable style={[styles.rejectOutline, { borderColor: colors.border, marginBottom: 20 }]} onPress={() => setShowRejectNotes(false)}>
                        <Text style={[styles.rejectOutlineText, { color: colors.mutedForeground }]}>Back to Approval</Text>
                      </Pressable>
                    </>
                  )}
                </>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Full-screen Screenshot Modal ──────────────────────────────────────── */}
      <Modal visible={screenshotModalVisible} animationType="fade" transparent statusBarTranslucent>
        <View style={styles.screenshotFullOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setScreenshotModalVisible(false)} />
          {fullScreenshot && <Image source={{ uri: `data:image/jpeg;base64,${fullScreenshot}` }} style={styles.screenshotFull} resizeMode="contain" />}
          <Pressable style={styles.screenshotFullClose} onPress={() => setScreenshotModalVisible(false)}>
            <Feather name="x" size={22} color="#fff" />
          </Pressable>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  monthNav: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", paddingVertical: 4 },
  navArrow: { padding: 8 },
  monthText: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: "#fff" },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  emptyState: { alignItems: "center", paddingVertical: 40, gap: 12 },
  emptyText: { fontSize: 14, textAlign: "center" },

  summaryCard: {
    borderRadius: 20, padding: 18, marginBottom: 16, marginTop: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.6)",
    shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 16, elevation: 6,
  },
  summaryTitle: { fontSize: 15, fontWeight: "700", marginBottom: 12 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1 },
  summaryKey: { fontSize: 14 },
  summaryVal: { fontSize: 14, fontWeight: "700" },

  pendingAlert: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 14 },
  pendingAlertText: { fontSize: 14, fontWeight: "700" },
  filterRow: { flexDirection: "row", gap: 8 },
  filterChip: {
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.7)", borderWidth: 1, borderColor: "rgba(148,163,184,0.22)",
    flexDirection: "row", alignItems: "center", gap: 6,
  },
  filterChipText: { fontSize: 13, fontWeight: "600" },
  chipBadge: { backgroundColor: ORANGE, borderRadius: 8, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  chipBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },

  payCard: {
    borderRadius: 20, marginBottom: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.6)",
    shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 16, elevation: 6,
    overflow: "hidden",
  },
  payCardHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, paddingBottom: 12 },
  payCardInfo: { flex: 1 },
  payCardName: { fontSize: 16, fontWeight: "700" },
  payCardSub: { fontSize: 12, marginTop: 2 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  statusBadgeText: { fontSize: 11, fontWeight: "700" },
  payCardDivider: { height: 1, marginHorizontal: 16 },
  payDetails: { paddingHorizontal: 16, paddingVertical: 10 },
  payDetailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 5 },
  payDetailLabel: { fontSize: 13 },
  payDetailVal: { fontSize: 14, fontWeight: "600" },
  thumbWrap: { marginHorizontal: 16, marginBottom: 12, borderRadius: 10, overflow: "hidden", height: 140 },
  thumb: { width: "100%", height: "100%" },
  thumbOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.30)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  thumbLabel: { color: "#fff", fontSize: 13, fontWeight: "600" },
  payActions: { flexDirection: "row", borderTopWidth: 1 },
  payActionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 13 },
  payActionText: { fontSize: 13, fontWeight: "700" },

  // UPI Settings
  upiCard: {
    borderRadius: 20, padding: 18, marginBottom: 20,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.6)",
    shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 16, elevation: 6,
  },
  upiCardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 18 },
  upiCardIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 2 },
  upiCardTitle: { fontSize: 16, fontWeight: "700", marginBottom: 2 },
  upiCardDesc: { fontSize: 13 },
  formGroup: { marginBottom: 14 },
  formLabel: { fontSize: 11, fontWeight: "700", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  formInput: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  qrPicker: { borderWidth: 1.5, borderRadius: 12, borderStyle: "dashed", alignItems: "center", justifyContent: "center", paddingVertical: 24, gap: 8 },
  qrPickerText: { fontSize: 14 },
  qrPreview: { width: 160, height: 160, borderRadius: 12 },
  qrBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  qrBtnText: { fontSize: 13, fontWeight: "600" },
  saveBtn: { borderRadius: 16, paddingVertical: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "#00000060", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingTop: 12, maxHeight: "92%" },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(148,163,184,0.4)", alignSelf: "center", marginBottom: 16 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: "700" },
  modalSub: { fontSize: 13, marginTop: 2 },
  verifyThumbWrap: { borderRadius: 14, overflow: "hidden", marginBottom: 14, height: 160 },
  verifyDetails: { borderRadius: 14, padding: 14, marginBottom: 16, gap: 6 },
  verifyDetailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  approveInput: { borderWidth: 2, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 28, fontWeight: "700", textAlign: "center", marginBottom: 10 },
  amountHint: { borderRadius: 10, padding: 10, marginBottom: 16 },
  rejectOutline: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, borderWidth: 1.5, paddingVertical: 13, marginBottom: 20 },
  rejectOutlineText: { fontSize: 14, fontWeight: "600" },

  // Cash payment
  cashBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 16, padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.6)",
    shadowColor: "#34D399", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  cashBtnIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cashBtnText: { flex: 1, fontSize: 15, fontWeight: "700" },
  cashMemberChip: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9, borderWidth: 1.5 },
  cashMemberChipText: { fontSize: 14, fontWeight: "600" },
  cashMonthRow: {
    flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1.5, overflow: "hidden",
  },
  cashMonthText: { flex: 1, textAlign: "center", fontSize: 15, fontWeight: "700" },
  cashMethodPill: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 16,
  },
  cashMethodPillText: { fontSize: 13, fontWeight: "600", flex: 1 },

  // Screenshot full
  screenshotFullOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
  screenshotFull: { width: "90%", height: "80%" },
  screenshotFullClose: { position: "absolute", top: 56, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
});
