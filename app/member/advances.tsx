import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useState } from "react";
import { ScreenHeader } from "@/components/ScreenHeader";
import { GradientBackground } from "@/components/GradientBackground";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";

import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";
import { useRefresh } from "@/hooks/useRefresh";
import { PRIMARY, PRIMARY2, EMERALD } from "@/constants/colors";

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

const SUMMARY_GRADIENTS: [string, string][] = [
  [EMERALD, "#10B981"],
  [PRIMARY, PRIMARY2],
  ["#F43F5E", "#E11D48"],
];

export default function MemberAdvances() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { advances, calculateMonthlyBill, refresh } = useData();
  const { refreshing, onRefresh } = useRefresh();
  const [month, setMonth] = useState(getCurrentMonth());

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const memberId   = user?.memberId ?? "";
  const myAdvances = advances
    .filter((a) => a.memberId === memberId && a.date.startsWith(month))
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));

  const totalAdvance = myAdvances.reduce((s, a) => s + a.amount, 0);
  const bill = calculateMonthlyBill(memberId, month);

  const summaryItems = [
    { label: "Total Paid",  value: `₹${totalAdvance.toFixed(0)}`,
      gradient: SUMMARY_GRADIENTS[0] as [string, string] },
    { label: "Gross Bill",  value: `₹${bill.grossBill.toFixed(0)}`,
      gradient: SUMMARY_GRADIENTS[1] as [string, string] },
    {
      label: bill.dueAmount > 0 ? "Due" : "Credit",
      value: `₹${(bill.dueAmount > 0 ? bill.dueAmount : bill.creditBalance).toFixed(0)}`,
      gradient: (bill.dueAmount > 0 ? SUMMARY_GRADIENTS[2] : SUMMARY_GRADIENTS[0]) as [string, string],
    },
  ];

  return (
    <GradientBackground>
      <ScreenHeader
        title="My Advances"
        avatarName={user?.name}
        avatarUrl={user?.photoUrl}
        subtitle="Advance payment history"
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

      {/* Summary cards */}
      <View style={styles.summaryRow}>
        {summaryItems.map(({ label, value, gradient }, i) => (
          <View key={label} style={styles.summaryCardWrapper}>
            <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{label}</Text>
              <Text style={styles.summaryVal}>{value}</Text>
            </LinearGradient>
          </View>
        ))}
      </View>

      {/* Advance list */}
      <FlatList
        data={myAdvances}
        keyExtractor={(a) => a.id}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 108 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PRIMARY]} tintColor={PRIMARY} />}
        removeClippedSubviews={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <Feather name="credit-card" size={32} color={EMERALD} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Advances</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Contact admin to record advance payments
            </Text>
          </View>
        }
        renderItem={({ item: a, index }) => (
          <View style={{ marginBottom: 12 }}>
            <View style={styles.advCard}>
              <View style={styles.advIconWrap}>
                <LinearGradient colors={[EMERALD, "#10B981"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.advIconGradient}>
                  <Feather name="arrow-up-right" size={20} color="#fff" />
                </LinearGradient>
              </View>
              <View style={styles.advInfo}>
                <Text style={[styles.advAmount, { color: EMERALD }]}>₹{a.amount.toFixed(0)}</Text>
                <Text style={[styles.advMeta, { color: colors.mutedForeground }]}>{a.date} · {a.method}</Text>
                {a.notes ? <Text style={[styles.advNotes, { color: colors.mutedForeground }]}>{a.notes}</Text> : null}
              </View>
              <View style={styles.paidBadge}>
                <Text style={styles.paidText}>Paid</Text>
              </View>
            </View>
          </View>
        )}
      />
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  summaryRow: { flexDirection: "row", paddingHorizontal: 16, gap: 12, marginVertical: 20 },
  summaryCardWrapper: {
    flex: 1, borderRadius: 20,
    shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 12, elevation: 6,
  },
  summaryCard: { borderRadius: 20, padding: 16, minHeight: 80, alignItems: "center", justifyContent: "center" },
  summaryLabel: { fontSize: 11, marginBottom: 6, fontWeight: "600", color: "rgba(255,255,255,0.85)", textTransform: "uppercase", letterSpacing: 0.5 },
  summaryVal: { fontSize: 22, fontWeight: "800", color: "#fff" },
  advCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    borderRadius: 18, padding: 16,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.6)",
    shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 3,
  },
  advIconWrap: { width: 48, height: 48, borderRadius: 14, overflow: "hidden", shadowColor: "#34D399", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  advIconGradient: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  advInfo: { flex: 1 },
  advAmount: { fontSize: 22, fontWeight: "800" },
  advMeta: { fontSize: 13, marginTop: 4 },
  advNotes: { fontSize: 12, marginTop: 2 },
  paidBadge: {
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
    backgroundColor: `${EMERALD}20`,
  },
  paidText: { fontSize: 12, fontWeight: "700", color: EMERALD },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#34D399", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 5,
  },
  empty: { alignItems: "center", paddingTop: 80, paddingHorizontal: 40, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyText: { fontSize: 14, textAlign: "center" },
  headerMonthNav: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", paddingVertical: 4,
  },
  headerNavBtn: { padding: 8 },
  headerMonthText: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: "#fff" },
});
