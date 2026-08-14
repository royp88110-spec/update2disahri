import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
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
function safeFix(n: number, digits = 0): string {
  return Number.isFinite(n) ? n.toFixed(digits) : "0";
}
function fmtDate(iso: string) { return iso.slice(0, 10); }

type PaymentState = "full" | "partial" | "none";

// ── Component ─────────────────────────────────────────────────────────────────
export default function MemberPayments() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const {
    calculateMonthlyBill, payments, settings, isLoaded,
    upiSettings, paymentSubmissions, submitUpiPayment,
  } = useData();
  const { showToast } = useToast();
  const { refreshing, onRefresh } = useRefresh();
  const [month, setMonth] = useState(getCurrentMonth());

  // Payment submission modal state
  const [payModal, setPayModal] = useState(false);
  const [claimedAmount, setClaimedAmount] = useState("");
  const [utrInput, setUtrInput] = useState("");
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPayUpiPrompt, setShowPayUpiPrompt] = useState(false);

  // Screenshot viewer
  const [screenshotModalVisible, setScreenshotModalVisible] = useState(false);
  const [fullScreenshot, setFullScreenshot] = useState<string | null>(null);

  const memberId = user?.memberId ?? "";

  // ── Derived data ──────────────────────────────────────────────────────────
  const bill = calculateMonthlyBill(memberId, month);
  const payment = payments.find((p) => p.memberId === memberId && p.month === month);
  const paidAmount: number = payment?.amount ?? 0;
  const paymentState: PaymentState =
    payment?.paid  ? "full"    :
    paidAmount > 0 ? "partial" :
                     "none";
  const remainingDue = Math.max(0, bill.dueAmount - paidAmount);

  const mySubmissions = paymentSubmissions
    .filter((s) => s.memberId === memberId && s.month === month)
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  const pendingSubmission = mySubmissions.find((s) => s.status === "pending");

  // ── Toast on payment change ──────────────────────────────────────────────
  const prevPayRef = useRef<{ paid: boolean; amount: number } | undefined>(undefined);
  useEffect(() => { prevPayRef.current = undefined; }, [month]);
  useEffect(() => {
    if (!payment) { prevPayRef.current = undefined; return; }
    const prev = prevPayRef.current;
    prevPayRef.current = { paid: payment.paid, amount: payment.amount };
    if (prev === undefined) return;
    if (prev.paid === payment.paid && prev.amount === payment.amount) return;
    if (payment.paid && !prev.paid) {
      showToast("Payment Complete 🎉", `₹${safeFix(payment.amount)} recorded for ${monthLabel(month)}`, "success");
    } else if (payment.amount > prev.amount) {
      const rem = safeFix(Math.max(0, bill.dueAmount - payment.amount));
      showToast("Payment Updated", `₹${safeFix(payment.amount)} received · ₹${rem} remaining`, "warning");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment?.paid, payment?.amount]);

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // ── UPI actions ───────────────────────────────────────────────────────────
  const upiConfigured = !!(upiSettings?.upiId);
  const hasDue = bill.dueAmount > 0 && remainingDue > 0;

  const handleCopyUpi = async () => {
    if (!upiSettings?.upiId) return;
    try { await Share.share({ message: upiSettings.upiId, title: "UPI ID" }); } catch {}
  };

  const handlePayViaUpi = async () => {
    if (!upiSettings?.upiId) return;
    const amount = remainingDue > 0 ? safeFix(remainingDue, 2) : "0";
    const note = upiSettings.paymentNote ?? "Mess bill payment";
    const name = encodeURIComponent(upiSettings.accountHolderName || "Dishari Mess");
    const noteEnc = encodeURIComponent(note);
    const upiUrl = `upi://pay?pa=${upiSettings.upiId}&pn=${name}&am=${amount}&tn=${noteEnc}&cu=INR`;
    // Try openURL directly — on Android release builds canOpenURL returns false
    // even when UPI apps are installed (package visibility restriction, API 30+).
    // The <queries> manifest entry allows the intent to resolve; we only show the
    // "not found" alert if openURL itself throws/rejects.
    try {
      await Linking.openURL(upiUrl);
      setShowPayUpiPrompt(true);
    } catch {
      Alert.alert("No UPI App Found", "Please install Google Pay, PhonePe, or any UPI app and try again.");
    }
  };

  const openPayModal = () => {
    setClaimedAmount(remainingDue > 0 ? safeFix(remainingDue, 2) : "");
    setUtrInput("");
    setScreenshotBase64(null);
    setPayModal(true);
  };

  const pickScreenshot = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please allow access to your photos to upload a screenshot.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.35,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      setScreenshotBase64(result.assets[0].base64);
    }
  };

  const handleSubmitPayment = async () => {
    const amount = parseFloat(claimedAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid payment amount.");
      return;
    }
    if (!utrInput.trim() && !screenshotBase64) {
      Alert.alert("Proof Required", "Please enter the UTR/Transaction ID or upload a payment screenshot.");
      return;
    }
    setIsSubmitting(true);
    try {
      await submitUpiPayment(memberId, month, amount, screenshotBase64, utrInput.trim() || null);
      setPayModal(false);
      setShowPayUpiPrompt(false);
      showToast("Payment Submitted ✓", "Pending admin verification", "success");
    } catch (err) {
      Alert.alert("Submission Failed", (err as Error).message || "Could not submit payment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Colour helpers ────────────────────────────────────────────────────────
  const card = colors.card;
  const cardText = colors.cardForeground;
  const muted = colors.mutedForeground;
  const borderColor = colors.border;

  const statusColors: [string, string] =
    paymentState === "full"    ? [EMERALD, "#10B981"] :
    paymentState === "partial" ? [ORANGE,  "#D97706"] :
                                  [RED,     "#E11D48"];

  const isDuePaid = paymentState === "full" || bill.dueAmount <= 0;

  return (
    <GradientBackground>
      <ScreenHeader
        title="My Payments"
        icon="credit-card"
        subtitle={monthLabel(month)}
        bottomElement={
          <View style={styles.monthNav}>
            <Pressable onPress={() => setMonth(prevMonth(month))} style={styles.navBtn}>
              <Feather name="chevron-left" size={20} color="rgba(255,255,255,0.9)" />
            </Pressable>
            <Text style={styles.monthText}>{monthLabel(month)}</Text>
            <Pressable onPress={() => setMonth(nextMonth(month))} style={styles.navBtn}>
              <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.9)" />
            </Pressable>
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 108 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PRIMARY]} tintColor={PRIMARY} />}
      >
        {/* ── Payment Status Card ────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
          <LinearGradient colors={statusColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.statusCard}>
            <View style={styles.statusCardTop}>
              <View style={styles.statusLeft}>
                <Text style={styles.statusLabel}>
                  {isDuePaid ? "Fully Paid ✓" : paymentState === "partial" ? "Partial Payment" : "Payment Due"}
                </Text>
                <Text style={styles.statusAmount}>
                  ₹{safeFix(isDuePaid ? (payment?.amount ?? 0) : remainingDue, 2)}
                </Text>
                <Text style={styles.statusSub}>
                  {isDuePaid
                    ? `Total paid for ${monthLabel(month)}`
                    : paymentState === "partial"
                      ? `Paid ₹${safeFix(paidAmount)} · ₹${safeFix(remainingDue)} remaining`
                      : `Due for ${monthLabel(month)}`}
                </Text>
                {paymentState === "partial" && bill.dueAmount > 0 && (
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${Math.min(100, (paidAmount / bill.dueAmount) * 100)}%` as `${number}%` }]} />
                  </View>
                )}
              </View>
              <View style={[styles.statusPill, paymentState === "partial" && { paddingHorizontal: 10 }]}>
                <Text style={styles.statusPillText}>
                  {paymentState === "full" ? "PAID" : paymentState === "partial" ? "PARTIAL" : "DUE"}
                </Text>
              </View>
            </View>
            <View style={styles.breakdownStrip}>
              {[
                { key: "Meals", val: `₹${safeFix(bill.mealBill)}` },
                { key: "Eggs",  val: `₹${safeFix(bill.eggBill)}` },
                { key: "Cook",  val: `₹${safeFix(bill.cookShare)}` },
                { key: "Fines", val: `₹${safeFix(bill.fineTotal)}` },
                { key: "Advance", val: `₹${safeFix(bill.totalAdvance)}` },
              ].map(({ key, val }, i) => (
                <React.Fragment key={key}>
                  {i > 0 && <View style={styles.stripDivider} />}
                  <View style={styles.stripItem}>
                    <Text style={styles.stripVal}>{val}</Text>
                    <Text style={styles.stripKey}>{key}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
          </LinearGradient>
        </View>

        {/* ── Full Bill Breakdown ────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={[styles.card, { backgroundColor: card }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIcon, { backgroundColor: `${PRIMARY}15` }]}>
                <Feather name="file-text" size={18} color={PRIMARY} />
              </View>
              <Text style={[styles.cardTitle, { color: cardText }]}>Bill Breakdown</Text>
            </View>

            {[
              { label: "Meal Rate",   val: `₹${safeFix(bill.perMealCost, 2)} / meal` },
              { label: "Meals Eaten", val: `${bill.mealCount} meal${bill.mealCount !== 1 ? "s" : ""}` },
            ].map(({ label, val }) => (
              <View key={label} style={[styles.row, { borderBottomColor: borderColor }]}>
                <Text style={[styles.rowLabel, { color: muted }]}>{label}</Text>
                <Text style={[styles.rowVal, { color: cardText }]}>{val}</Text>
              </View>
            ))}

            <View style={[styles.rowDivider, { borderBottomColor: borderColor }]}>
              <Text style={[styles.rowDividerLabel, { color: muted }]}>Components</Text>
            </View>

            {[
              { label: "Meal Cost",   val: `₹${safeFix(bill.mealBill, 2)}`,  icon: "dollar-sign",  color: ORANGE },
              { label: `Eggs (${bill.eggCount} × ₹${settings.eggPrice})`, val: `₹${safeFix(bill.eggBill, 2)}`, icon: "sun", color: YELLOW },
              { label: "Cook Salary", val: `₹${safeFix(bill.cookShare, 2)}`, icon: "users",        color: CYAN },
              { label: "Fine",        val: `₹${safeFix(bill.fineTotal, 2)}`, icon: "alert-circle", color: RED },
            ].map(({ label, val, icon, color }) => (
              <View key={label} style={[styles.row, { borderBottomColor: borderColor }]}>
                <View style={styles.rowLabelGroup}>
                  <View style={[styles.rowDot, { backgroundColor: `${color}18` }]}>
                    <Feather name={icon as "grid"} size={12} color={color} />
                  </View>
                  <Text style={[styles.rowLabel, { color: muted }]}>{label}</Text>
                </View>
                <Text style={[styles.rowVal, { color: cardText }]}>{val}</Text>
              </View>
            ))}

            <View style={[styles.row, { borderBottomColor: borderColor }]}>
              <Text style={[styles.rowLabel, { color: cardText, fontWeight: "700" }]}>Gross Bill</Text>
              <Text style={[styles.rowVal, { color: PRIMARY, fontWeight: "800", fontSize: 16 }]}>
                ₹{safeFix(bill.grossBill, 2)}
              </Text>
            </View>

            <View style={[styles.row, { borderBottomColor: borderColor }]}>
              <View style={styles.rowLabelGroup}>
                <View style={[styles.rowDot, { backgroundColor: `${EMERALD}18` }]}>
                  <Feather name="minus-circle" size={12} color={EMERALD} />
                </View>
                <Text style={[styles.rowLabel, { color: muted }]}>Advance Deduction</Text>
              </View>
              <Text style={[styles.rowVal, { color: EMERALD, fontWeight: "600" }]}>
                − ₹{safeFix(bill.totalAdvance, 2)}
              </Text>
            </View>

            <View style={[styles.rowFinal, { borderTopColor: borderColor }]}>
              <Text style={[styles.rowLabel, { color: cardText, fontWeight: "700", fontSize: 15 }]}>
                {bill.dueAmount > 0 ? "Final Payable" : "Credit Balance"}
              </Text>
              <Text style={[styles.rowVal, { color: bill.dueAmount > 0 ? RED : EMERALD, fontWeight: "900", fontSize: 20 }]}>
                ₹{safeFix(bill.dueAmount > 0 ? bill.dueAmount : bill.creditBalance, 2)}
              </Text>
            </View>

            {/* Payment tracker row */}
            {(paidAmount > 0 || paymentState === "full") && (
              <>
                <View style={[styles.row, { borderBottomColor: borderColor }]}>
                  <View style={styles.rowLabelGroup}>
                    <View style={[styles.rowDot, { backgroundColor: `${EMERALD}18` }]}>
                      <Feather name="check-circle" size={12} color={EMERALD} />
                    </View>
                    <Text style={[styles.rowLabel, { color: muted }]}>UPI Payments Received</Text>
                  </View>
                  <Text style={[styles.rowVal, { color: EMERALD, fontWeight: "700" }]}>
                    ₹{safeFix(paidAmount, 2)}
                  </Text>
                </View>
                <View style={[styles.row, { borderBottomColor: borderColor }]}>
                  <Text style={[styles.rowLabel, { color: cardText, fontWeight: "700" }]}>
                    {remainingDue > 0 ? "Still Remaining" : "Settled ✓"}
                  </Text>
                  <Text style={[styles.rowVal, { color: remainingDue > 0 ? ORANGE : EMERALD, fontWeight: "800", fontSize: 16 }]}>
                    ₹{safeFix(remainingDue, 2)}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* ── UPI Payment Section ────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={[styles.card, { backgroundColor: card }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIcon, { backgroundColor: "#7C3AED15" }]}>
                <Feather name="send" size={18} color="#7C3AED" />
              </View>
              <Text style={[styles.cardTitle, { color: cardText }]}>Pay via UPI</Text>
              {pendingSubmission && (
                <View style={[styles.pendingBadge, { backgroundColor: `${ORANGE}20` }]}>
                  <Text style={[styles.pendingBadgeText, { color: ORANGE }]}>PENDING</Text>
                </View>
              )}
            </View>

            {!upiConfigured ? (
              <View style={[styles.notice, { backgroundColor: `${PRIMARY}10`, borderColor: `${PRIMARY}20` }]}>
                <Feather name="info" size={16} color={PRIMARY} />
                <Text style={[styles.noticeText, { color: muted }]}>
                  UPI payment is not configured yet. Ask your admin to set it up.
                </Text>
              </View>
            ) : !hasDue && mySubmissions.length === 0 ? (
              <View style={[styles.notice, { backgroundColor: `${EMERALD}10`, borderColor: `${EMERALD}20` }]}>
                <Feather name="check-circle" size={16} color={EMERALD} />
                <Text style={[styles.noticeText, { color: EMERALD }]}>
                  You&apos;re all clear! No payment due for {monthLabel(month)}.
                </Text>
              </View>
            ) : (
              <>
                {hasDue && !pendingSubmission && (
                  <>
                    {/* Amount to Pay */}
                    <View style={[styles.amountRow, { backgroundColor: `${PRIMARY}08`, borderColor: `${PRIMARY}15` }]}>
                      <View>
                        <Text style={[styles.amountLabel, { color: muted }]}>Amount to Pay</Text>
                        <Text style={[styles.amountVal, { color: PRIMARY }]}>₹{safeFix(remainingDue, 2)}</Text>
                      </View>
                      <Feather name="arrow-right-circle" size={28} color={`${PRIMARY}60`} />
                    </View>

                    {/* UPI ID */}
                    <View style={[styles.upiRow, { borderBottomColor: borderColor }]}>
                      <View style={[styles.upiRowIcon, { backgroundColor: "#7C3AED15" }]}>
                        <Feather name="at-sign" size={16} color="#7C3AED" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.upiRowLabel, { color: muted }]}>UPI ID</Text>
                        <Text style={[styles.upiRowVal, { color: cardText }]} numberOfLines={1}>{upiSettings!.upiId}</Text>
                      </View>
                      <Pressable style={[styles.copyBtn, { backgroundColor: `${PRIMARY}12` }]} onPress={handleCopyUpi} hitSlop={8}>
                        <Feather name="copy" size={14} color={PRIMARY} />
                        <Text style={[styles.copyBtnText, { color: PRIMARY }]}>Share</Text>
                      </Pressable>
                    </View>

                    {upiSettings!.accountHolderName ? (
                      <View style={[styles.upiRow, { borderBottomColor: borderColor }]}>
                        <View style={[styles.upiRowIcon, { backgroundColor: `${EMERALD}15` }]}>
                          <Feather name="user" size={16} color={EMERALD} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.upiRowLabel, { color: muted }]}>Account Holder</Text>
                          <Text style={[styles.upiRowVal, { color: cardText }]}>{upiSettings!.accountHolderName}</Text>
                        </View>
                      </View>
                    ) : null}

                    {upiSettings!.paymentNote ? (
                      <View style={[styles.notice, { backgroundColor: `${YELLOW}10`, borderColor: `${YELLOW}20`, marginTop: 8 }]}>
                        <Feather name="message-circle" size={14} color={YELLOW} />
                        <Text style={[styles.noticeText, { color: muted }]}>{upiSettings!.paymentNote}</Text>
                      </View>
                    ) : null}

                    {upiSettings!.qrCodeBase64 ? (
                      <View style={styles.qrContainer}>
                        <Image source={{ uri: `data:image/jpeg;base64,${upiSettings!.qrCodeBase64}` }} style={styles.qrImage} resizeMode="contain" />
                        <Text style={[styles.qrLabel, { color: muted }]}>Scan QR to pay</Text>
                      </View>
                    ) : null}

                    <Pressable style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1, marginTop: 16 }]} onPress={handlePayViaUpi}>
                      <LinearGradient colors={["#7C3AED", "#4F46E5"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.payBtn}>
                        <Feather name="send" size={18} color="#fff" />
                        <Text style={styles.payBtnText}>Pay via UPI App</Text>
                      </LinearGradient>
                    </Pressable>

                    {showPayUpiPrompt && (
                      <Pressable style={[styles.proofBtn, { borderColor: EMERALD, backgroundColor: `${EMERALD}10` }]} onPress={openPayModal}>
                        <Feather name="check-circle" size={16} color={EMERALD} />
                        <Text style={[styles.proofBtnText, { color: EMERALD }]}>I&apos;ve Made the Payment — Record it</Text>
                      </Pressable>
                    )}

                    {!showPayUpiPrompt && (
                      <Pressable style={[styles.proofBtn, { borderColor: borderColor, backgroundColor: `${PRIMARY}06` }]} onPress={openPayModal}>
                        <Feather name="upload" size={16} color={muted} />
                        <Text style={[styles.proofBtnText, { color: muted }]}>Already paid? Submit proof</Text>
                      </Pressable>
                    )}
                  </>
                )}

                {/* Pending Submission */}
                {pendingSubmission && (
                  <View style={[styles.subCard, { backgroundColor: `${ORANGE}10`, borderColor: `${ORANGE}30` }]}>
                    <View style={styles.subCardHeader}>
                      <Feather name="clock" size={16} color={ORANGE} />
                      <Text style={[styles.subCardTitle, { color: ORANGE }]}>Pending Verification</Text>
                    </View>
                    <View style={[styles.subRow, { borderBottomColor: `${ORANGE}20` }]}>
                      <Text style={[styles.subLabel, { color: muted }]}>Claimed Amount</Text>
                      <Text style={[styles.subVal, { color: cardText }]}>₹{safeFix(pendingSubmission.claimedAmount, 2)}</Text>
                    </View>
                    {pendingSubmission.utr ? (
                      <View style={[styles.subRow, { borderBottomColor: `${ORANGE}20` }]}>
                        <Text style={[styles.subLabel, { color: muted }]}>UTR / Txn ID</Text>
                        <Text style={[styles.subVal, { color: cardText }]}>{pendingSubmission.utr}</Text>
                      </View>
                    ) : null}
                    <View style={styles.subRow}>
                      <Text style={[styles.subLabel, { color: muted }]}>Submitted</Text>
                      <Text style={[styles.subVal, { color: muted }]}>{fmtDate(pendingSubmission.submittedAt)}</Text>
                    </View>
                    {pendingSubmission.screenshotBase64 && (
                      <Pressable onPress={() => { setFullScreenshot(pendingSubmission.screenshotBase64); setScreenshotModalVisible(true); }}>
                        <Image source={{ uri: `data:image/jpeg;base64,${pendingSubmission.screenshotBase64}` }} style={styles.subThumb} resizeMode="cover" />
                        <Text style={[styles.subThumbLabel, { color: muted }]}>Tap to view screenshot</Text>
                      </Pressable>
                    )}
                    {remainingDue > pendingSubmission.claimedAmount && (
                      <Pressable style={[styles.proofBtn, { borderColor: borderColor, backgroundColor: `${PRIMARY}06`, marginTop: 12 }]} onPress={openPayModal}>
                        <Feather name="plus" size={14} color={muted} />
                        <Text style={[styles.proofBtnText, { color: muted }]}>Submit another payment</Text>
                      </Pressable>
                    )}
                  </View>
                )}

                {/* Approved submissions */}
                {mySubmissions.filter((s) => s.status === "approved").map((s) => (
                  <View key={s.id} style={[styles.subCard, { backgroundColor: `${EMERALD}10`, borderColor: `${EMERALD}30`, marginTop: 10 }]}>
                    <View style={styles.subCardHeader}>
                      <Feather name="check-circle" size={16} color={EMERALD} />
                      <Text style={[styles.subCardTitle, { color: EMERALD }]}>Payment Approved</Text>
                    </View>
                    <View style={styles.subRow}>
                      <Text style={[styles.subLabel, { color: muted }]}>Approved Amount</Text>
                      <Text style={[styles.subVal, { color: EMERALD, fontWeight: "700" }]}>₹{safeFix(s.approvedAmount ?? 0, 2)}</Text>
                    </View>
                    {s.paymentMethod === "cash" && (
                      <View style={styles.subRow}>
                        <Text style={[styles.subLabel, { color: muted }]}>Payment Method</Text>
                        <Text style={[styles.subVal, { color: muted }]}>Cash</Text>
                      </View>
                    )}
                    <View style={styles.subRow}>
                      <Text style={[styles.subLabel, { color: muted }]}>Date</Text>
                      <Text style={[styles.subVal, { color: muted }]}>{fmtDate(s.reviewedAt ?? s.submittedAt)}</Text>
                    </View>
                  </View>
                ))}

                {/* Rejected submissions */}
                {mySubmissions.filter((s) => s.status === "rejected").map((s) => (
                  <View key={s.id} style={[styles.subCard, { backgroundColor: `${RED}10`, borderColor: `${RED}30`, marginTop: 10 }]}>
                    <View style={styles.subCardHeader}>
                      <Feather name="x-circle" size={16} color={RED} />
                      <Text style={[styles.subCardTitle, { color: RED }]}>Payment Rejected</Text>
                    </View>
                    {s.adminNotes ? (
                      <Text style={[styles.subLabel, { color: muted, marginTop: 4 }]}>{s.adminNotes}</Text>
                    ) : null}
                    <Pressable style={[styles.proofBtn, { borderColor: RED, backgroundColor: `${RED}08`, marginTop: 10 }]} onPress={openPayModal}>
                      <Feather name="refresh-cw" size={14} color={RED} />
                      <Text style={[styles.proofBtnText, { color: RED }]}>Resubmit Payment</Text>
                    </Pressable>
                  </View>
                ))}
              </>
            )}
          </View>
        </View>
      </ScrollView>

      {/* ── Payment Submission Modal ─────────────────────────────────────────── */}
      <Modal visible={payModal} animationType="slide" transparent statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <ScrollView style={{ width: "100%" }} contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }} keyboardShouldPersistTaps="handled">
            <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <View>
                  <Text style={[styles.modalTitle, { color: colors.foreground }]}>Submit Payment</Text>
                  <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>Pending admin verification</Text>
                </View>
                <Pressable onPress={() => setPayModal(false)} hitSlop={10}>
                  <Feather name="x" size={22} color={colors.mutedForeground} />
                </Pressable>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>AMOUNT PAID (₹)</Text>
                <TextInput
                  style={[styles.formInput, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]}
                  value={claimedAmount}
                  onChangeText={setClaimedAmount}
                  keyboardType="decimal-pad"
                  placeholder={`₹${safeFix(remainingDue, 2)}`}
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>UTR / TRANSACTION ID</Text>
                <TextInput
                  style={[styles.formInput, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]}
                  value={utrInput}
                  onChangeText={setUtrInput}
                  placeholder="e.g. 123456789012"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>PAYMENT SCREENSHOT (OPTIONAL)</Text>
                {screenshotBase64 ? (
                  <View style={{ position: "relative" }}>
                    <Image source={{ uri: `data:image/jpeg;base64,${screenshotBase64}` }} style={styles.screenshotImg} resizeMode="cover" />
                    <Pressable style={[styles.screenshotRemove, { backgroundColor: RED }]} onPress={() => setScreenshotBase64(null)}>
                      <Feather name="x" size={14} color="#fff" />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable style={[styles.screenshotPicker, { borderColor: colors.border, backgroundColor: colors.muted }]} onPress={pickScreenshot}>
                    <Feather name="image" size={22} color={colors.mutedForeground} />
                    <Text style={[styles.screenshotPickerText, { color: colors.mutedForeground }]}>Tap to upload screenshot</Text>
                  </Pressable>
                )}
              </View>

              <View style={[styles.notice, { backgroundColor: `${PRIMARY}08`, borderColor: `${PRIMARY}15`, marginBottom: 16 }]}>
                <Feather name="info" size={13} color={PRIMARY} />
                <Text style={[styles.noticeText, { color: colors.mutedForeground }]}>
                  Your payment stays "Pending" until the admin approves it.
                </Text>
              </View>

              <Pressable style={({ pressed }) => [{ opacity: (pressed || isSubmitting) ? 0.75 : 1, marginBottom: 20 }]} onPress={handleSubmitPayment} disabled={isSubmitting}>
                <LinearGradient colors={["#7C3AED", "#4F46E5"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submitBtn}>
                  {isSubmitting ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="send" size={18} color="#fff" />}
                  <Text style={styles.submitBtnText}>{isSubmitting ? "Submitting…" : "Submit Payment"}</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Full-screen Screenshot Modal ──────────────────────────────────────── */}
      <Modal visible={screenshotModalVisible} animationType="fade" transparent statusBarTranslucent>
        <View style={styles.screenshotFullOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setScreenshotModalVisible(false)} />
          {fullScreenshot && (
            <Image source={{ uri: `data:image/jpeg;base64,${fullScreenshot}` }} style={styles.screenshotFull} resizeMode="contain" />
          )}
          <Pressable style={styles.screenshotFullClose} onPress={() => setScreenshotModalVisible(false)}>
            <Feather name="x" size={22} color="#fff" />
          </Pressable>
        </View>
      </Modal>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  monthNav: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", paddingVertical: 4,
  },
  navBtn: { padding: 8 },
  monthText: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: "#fff" },
  section: { paddingHorizontal: 20, marginTop: 20 },
  card: {
    borderRadius: 22, borderWidth: 1, borderColor: "rgba(148,163,184,0.22)",
    shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10, shadowRadius: 16, elevation: 6, padding: 18,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  cardIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 16, fontWeight: "700", flex: 1 },

  // Status card
  statusCard: {
    borderRadius: 28, overflow: "hidden",
    shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28, shadowRadius: 24, elevation: 14,
  },
  statusCardTop: { flexDirection: "row", alignItems: "flex-start", padding: 24, paddingBottom: 20 },
  statusLeft: { flex: 1 },
  statusLabel: { fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.85)", marginBottom: 6 },
  statusAmount: { fontSize: 40, fontWeight: "900", color: "#fff", letterSpacing: -1 },
  statusSub: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 6 },
  statusPill: { backgroundColor: "rgba(255,255,255,0.25)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusPillText: { fontSize: 10, fontWeight: "900", color: "#fff", letterSpacing: 0.8 },
  progressTrack: { marginTop: 10, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.25)", overflow: "hidden", width: "80%" },
  progressFill: { height: "100%", borderRadius: 3, backgroundColor: "rgba(255,255,255,0.85)" },
  breakdownStrip: { flexDirection: "row", backgroundColor: "rgba(0,0,0,0.15)", paddingVertical: 12, paddingHorizontal: 16 },
  stripItem: { flex: 1, alignItems: "center" },
  stripVal: { fontSize: 13, fontWeight: "700", color: "#fff" },
  stripKey: { fontSize: 9, color: "rgba(255,255,255,0.72)", marginTop: 2, fontWeight: "500" },
  stripDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.2)", marginHorizontal: 2 },

  // Bill rows
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 11, borderBottomWidth: 1 },
  rowFinal: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, borderTopWidth: 1.5, marginTop: 4 },
  rowDivider: { paddingBottom: 6, borderBottomWidth: 1, marginTop: 6, marginBottom: 2 },
  rowDividerLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase" },
  rowLabelGroup: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  rowDot: { width: 24, height: 24, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  rowLabel: { fontSize: 14 },
  rowVal: { fontSize: 15, fontWeight: "600" },

  // UPI section
  pendingBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  pendingBadgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  notice: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  noticeText: { fontSize: 13, flex: 1, lineHeight: 18 },
  amountRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 14 },
  amountLabel: { fontSize: 12, fontWeight: "600", marginBottom: 3 },
  amountVal: { fontSize: 28, fontWeight: "900", letterSpacing: -0.5 },
  upiRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1 },
  upiRowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  upiRowLabel: { fontSize: 11, fontWeight: "600", marginBottom: 2 },
  upiRowVal: { fontSize: 15, fontWeight: "700" },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  copyBtnText: { fontSize: 12, fontWeight: "700" },
  qrContainer: { alignItems: "center", marginTop: 16, marginBottom: 4 },
  qrImage: { width: 180, height: 180, borderRadius: 12, borderWidth: 1, borderColor: "rgba(148,163,184,0.22)" },
  qrLabel: { fontSize: 12, marginTop: 8 },
  payBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 16, paddingVertical: 16 },
  payBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  proofBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, borderWidth: 1.5, paddingVertical: 12, marginTop: 10 },
  proofBtnText: { fontSize: 13, fontWeight: "600" },

  // Submission cards
  subCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 4 },
  subCardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  subCardTitle: { fontSize: 14, fontWeight: "700" },
  subRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6, borderBottomWidth: 1 },
  subLabel: { fontSize: 12 },
  subVal: { fontSize: 13, fontWeight: "600" },
  subThumb: { width: "100%", height: 120, borderRadius: 10, marginTop: 10 },
  subThumbLabel: { fontSize: 11, textAlign: "center", marginTop: 4 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "#00000070", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingTop: 12, maxHeight: "92%" },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(148,163,184,0.4)", alignSelf: "center", marginBottom: 16 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: "800" },
  modalSub: { fontSize: 13, marginTop: 2 },
  formGroup: { marginBottom: 16 },
  formLabel: { fontSize: 11, fontWeight: "700", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.6 },
  formInput: { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16 },
  screenshotPicker: { borderWidth: 1.5, borderRadius: 14, borderStyle: "dashed", alignItems: "center", justifyContent: "center", paddingVertical: 28, gap: 8 },
  screenshotPickerText: { fontSize: 14 },
  screenshotImg: { width: "100%", height: 160, borderRadius: 12 },
  screenshotRemove: { position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 16, paddingVertical: 16 },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },

  // Screenshot full screen
  screenshotFullOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
  screenshotFull: { width: "90%", height: "80%" },
  screenshotFullClose: { position: "absolute", top: 56, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
});
