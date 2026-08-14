import { Feather } from "@expo/vector-icons";
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
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";

import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";
import { useRefresh } from "@/hooks/useRefresh";
import { PRIMARY, PRIMARY2 } from "@/constants/colors";

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
  ["#4F46E5", "#7C3AED"],
  ["#22D3EE", "#38BDF8"],
  ["#34D399", "#10B981"],
];

export default function MemberMeals() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { meals, refresh } = useData();
  const { refreshing, onRefresh } = useRefresh();
  const [month, setMonth] = useState(getCurrentMonth());

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const memberId = user?.memberId ?? "";
  const memberMeals = meals
    .filter((m) => m.memberId === memberId && m.date.startsWith(month))
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));

  const totalMorning = memberMeals.filter((m) => m.morning).length;
  const totalNight   = memberMeals.filter((m) => m.night).length;
  const totalMeals   = totalMorning + totalNight;

  return (
    <GradientBackground>
      <ScreenHeader
        title="My Meals"
        avatarName={user?.name}
        avatarUrl={user?.photoUrl}
        subtitle="Your meal history"
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
        {[
          { label: "Morning", count: totalMorning, delay: 60,  gradient: SUMMARY_GRADIENTS[0] },
          { label: "Night",   count: totalNight,   delay: 130, gradient: SUMMARY_GRADIENTS[1] },
          { label: "Total",   count: totalMeals,   delay: 200, gradient: SUMMARY_GRADIENTS[2] },
        ].map(({ label, count, delay, gradient }) => (
          <View key={label} style={styles.summaryCardWrapper}>
            <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.summaryCard}>
              <Text style={styles.summaryCount}>{count}</Text>
              <Text style={styles.summaryLabel}>{label}</Text>
            </LinearGradient>
          </View>
        ))}
      </View>

      {/* Table header */}
      <View style={[styles.tableHeader, { backgroundColor: "rgba(255,255,255,0.55)" }]}>
        <Text style={[styles.colDate,  { color: colors.mutedForeground }]}>DATE</Text>
        <Text style={[styles.colMeal,  { color: PRIMARY }]}>MORNING</Text>
        <Text style={[styles.colMeal,  { color: PRIMARY2 }]}>NIGHT</Text>
        <Text style={[styles.colTotal, { color: colors.mutedForeground }]}>TOTAL</Text>
      </View>

      <FlatList
        data={memberMeals}
        keyExtractor={(m) => m.id}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 108 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PRIMARY]} tintColor={PRIMARY} />
        }
        removeClippedSubviews={false}
        ItemSeparatorComponent={() => (
          <View style={{ height: 1, backgroundColor: "rgba(148,163,184,0.15)" }} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: "rgba(255,255,255,0.7)" }]}>
              <Feather name="calendar" size={32} color={PRIMARY} />
            </View>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No meal records this month</Text>
          </View>
        }
        renderItem={({ item: m, index }) => {
          const total   = (m.morning ? 1 : 0) + (m.night ? 1 : 0);
          const dayName = new Date(m.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short" });
          const dayNum  = m.date.split("-")[2];
          return (
            <View>
              <View style={[styles.mealRow, { backgroundColor: "rgba(255,255,255,0.75)" }]}>
                <View style={styles.dateCol}>
                  <Text style={[styles.dayNum, { color: colors.foreground }]}>{dayNum}</Text>
                  <Text style={[styles.dayName, { color: colors.mutedForeground }]}>{dayName}</Text>
                </View>
                <View style={styles.mealCol}>
                  <View style={[styles.mealBadge, { backgroundColor: m.morning ? `${PRIMARY}20` : "rgba(148,163,184,0.15)" }]}>
                    <Feather name={m.morning ? "check" : "x"} size={16} color={m.morning ? PRIMARY : colors.mutedForeground} />
                  </View>
                </View>
                <View style={styles.mealCol}>
                  <View style={[styles.mealBadge, { backgroundColor: m.night ? `${PRIMARY2}20` : "rgba(148,163,184,0.15)" }]}>
                    <Feather name={m.night ? "check" : "x"} size={16} color={m.night ? PRIMARY2 : colors.mutedForeground} />
                  </View>
                </View>
                <View style={[styles.totalBadge, { backgroundColor: total > 0 ? "#22D3EE20" : "rgba(148,163,184,0.15)" }]}>
                  <Text style={[styles.totalText, { color: total > 0 ? "#22D3EE" : colors.mutedForeground }]}>{total}</Text>
                </View>
              </View>
            </View>
          );
        }}
      />
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  summaryRow: { flexDirection: "row", paddingHorizontal: 16, gap: 12, marginVertical: 16 },
  summaryCardWrapper: { flex: 1, borderRadius: 20, shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 12, elevation: 6 },
  summaryCard: { borderRadius: 20, padding: 18, minHeight: 80, alignItems: "center", justifyContent: "center" },
  summaryCount: { fontSize: 26, fontWeight: "800", color: "#fff" },
  summaryLabel: { fontSize: 12, marginTop: 4, color: "rgba(255,255,255,0.85)", fontWeight: "600" },
  tableHeader: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: 12, marginHorizontal: 12, marginBottom: 4,
  },
  colDate:  { width: 64, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  colMeal:  { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  colTotal: { width: 52, textAlign: "center", fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  mealRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
  dateCol: { width: 64 },
  dayNum:  { fontSize: 16, fontWeight: "700" },
  dayName: { fontSize: 11 },
  mealCol: { flex: 1, alignItems: "center" },
  mealBadge: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  totalBadge: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  totalText: { fontSize: 15, fontWeight: "700" },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: 15 },
  headerMonthNav: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", paddingVertical: 4,
  },
  headerNavBtn: { padding: 8 },
  headerMonthText: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: "#fff" },
});
