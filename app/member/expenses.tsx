import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
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

import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";
import { useRefresh } from "@/hooks/useRefresh";
import { PRIMARY, PRIMARY2 } from "@/constants/colors";

const CATEGORIES = [
  { key: "all",       label: "All",     icon: "list",            color: "#4F46E5" },
  { key: "grocery",   label: "Grocery", icon: "shopping-bag",    color: "#38BDF8" },
  { key: "vegetable", label: "Veg",     icon: "box",             color: "#34D399" },
  { key: "fish",      label: "Fish",    icon: "droplet",         color: "#22D3EE" },
  { key: "meat",      label: "Meat",    icon: "heart",           color: "#EC4899" },
  { key: "gas",       label: "Gas",     icon: "zap",             color: "#FACC15" },
  { key: "other",     label: "Other",   icon: "more-horizontal", color: "#FB923C" },
];

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

export default function MemberExpenses() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { expenses, settings, members } = useData();
  const { refreshing, onRefresh } = useRefresh();
  const [month, setMonth] = useState(getCurrentMonth());
  const [category, setCategory] = useState("all");

  const monthExpenses = expenses.filter((e) => e.date.startsWith(month));
  const filtered = category === "all" ? monthExpenses : monthExpenses.filter((e) => e.type === category);
  const total       = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const activeCount = members.filter((m) => m.status === "active").length;
  const cookTotal   = settings.cookSalary * activeCount;
  const grandTotal  = total + cookTotal;

  const getCat = (type: string) =>
    CATEGORIES.find((c) => c.key === type) ?? CATEGORIES[CATEGORIES.length - 1];

  return (
    <GradientBackground>
      <ScreenHeader
        title="Expenses"
        avatarName={user?.name}
        avatarUrl={user?.photoUrl}
        subtitle="Mess expense breakdown"
        bottomElement={
          <View style={styles.headerMonthNav}>
            <Pressable onPress={() => setMonth(prevMonth(month))} style={styles.headerNavBtn}>
              <Feather name="chevron-left" size={20} color="rgba(255,255,255,0.9)" />
            </Pressable>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={styles.headerMonthText}>{monthLabel(month)}</Text>
              <Text style={styles.headerMonthSub}>Total: ₹{grandTotal.toFixed(0)}</Text>
            </View>
            <Pressable onPress={() => setMonth(nextMonth(month))} style={styles.headerNavBtn}>
              <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.9)" />
            </Pressable>
          </View>
        }
      />

      {/* Summary */}
      <View>
        <View style={styles.summaryCard}>
          {[
            { label: "Market Exp.", val: `₹${total.toFixed(0)}`, color: colors.foreground },
            { label: "Cook Salary", val: `₹${cookTotal.toFixed(0)}`, color: colors.foreground },
            { label: "Grand Total", val: `₹${grandTotal.toFixed(0)}`, color: PRIMARY },
          ].map(({ label, val, color }, i, arr) => (
            <View key={label} style={styles.summaryItem}>
              <Text style={[styles.summaryVal, { color }]}>{val}</Text>
              <Text style={[styles.summaryKey, { color: colors.mutedForeground }]}>{label}</Text>
              {i < arr.length - 1 && <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />}
            </View>
          ))}
        </View>
      </View>

      {/* Category chips */}
      <FlatList
        horizontal
        data={CATEGORIES}
        keyExtractor={(c) => c.key}
        style={styles.catScroll}
        contentContainerStyle={styles.catContent}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item: c }) => (
          <Pressable
            style={[styles.catChip, { backgroundColor: category === c.key ? c.color : "rgba(255,255,255,0.7)" }]}
            onPress={() => setCategory(c.key)}
          >
            <Feather name={c.icon as "list"} size={13} color={category === c.key ? "#fff" : colors.mutedForeground} />
            <Text style={[styles.catText, { color: category === c.key ? "#fff" : colors.mutedForeground }]}>{c.label}</Text>
          </Pressable>
        )}
      />

      <FlatList
        data={filtered.slice().reverse()}
        keyExtractor={(e) => e.id}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 108 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PRIMARY]} tintColor={PRIMARY} />}
        removeClippedSubviews={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Feather name="bar-chart-2" size={32} color={PRIMARY} />
            </View>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No expenses this month</Text>
          </View>
        }
        renderItem={({ item: e, index }) => {
          const cat = getCat(e.type);
          return (
            <View style={{ marginBottom: 10 }}>
              <View style={styles.expenseRow}>
                <View style={[styles.expIcon, { backgroundColor: cat.color + "20" }]}>
                  <Feather name={cat.icon as "list"} size={20} color={cat.color} />
                </View>
                <View style={styles.expInfo}>
                  <Text style={[styles.expName, { color: colors.foreground }]}>{cat.label}{e.shopName ? ` · ${e.shopName}` : ""}</Text>
                  {e.items ? <Text style={[styles.expMeta, { color: colors.mutedForeground }]}>{e.items}</Text> : null}
                  <Text style={[styles.expDate, { color: colors.mutedForeground }]}>{e.date}</Text>
                </View>
                <Text style={[styles.expAmount, { color: colors.foreground }]}>₹{e.amount}</Text>
              </View>
            </View>
          );
        }}
      />
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    flexDirection: "row", marginHorizontal: 16, marginVertical: 16,
    borderRadius: 20, padding: 20,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.6)",
    shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10, shadowRadius: 16, elevation: 6,
  },
  summaryItem: { flex: 1, alignItems: "center", position: "relative" },
  summaryVal: { fontSize: 20, fontWeight: "800" },
  summaryKey: { fontSize: 12, marginTop: 4 },
  summaryDivider: { position: "absolute", right: 0, top: "10%", bottom: "10%", width: 1 },
  catScroll: { flexGrow: 0 },
  catContent: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  catChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.6)",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  catText: { fontSize: 13, fontWeight: "600" },
  expenseRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 18, padding: 14,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.6)",
    shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
  },
  expIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  expInfo: { flex: 1 },
  expName: { fontSize: 15, fontWeight: "700" },
  expMeta: { fontSize: 13, marginTop: 1 },
  expDate: { fontSize: 11, marginTop: 4 },
  expAmount: { fontSize: 17, fontWeight: "700" },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(255,255,255,0.8)", alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: 15 },
  headerMonthNav: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", paddingVertical: 4,
  },
  headerNavBtn: { padding: 8 },
  headerMonthText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  headerMonthSub: { fontSize: 11, color: "rgba(255,255,255,0.8)", marginTop: 2 },
});
