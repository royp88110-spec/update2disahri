import { Feather } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
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
import { ScreenHeader } from "@/components/ScreenHeader";
import { GradientBackground } from "@/components/GradientBackground";
import { useRefresh } from "@/hooks/useRefresh";
import { PRIMARY, PRIMARY2, EMERALD, RED } from "@/constants/colors";

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
  const names = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];
  return `${names[parseInt(mo) - 1]} ${y}`;
}

export default function MemberFinesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { fines, refresh } = useData();
  const { refreshing, onRefresh } = useRefresh();
  const [month, setMonth] = useState(getCurrentMonth());

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const memberId = user?.memberId ?? "";
  const myFines  = fines.filter(
    (f) => f.memberId === memberId && f.date.startsWith(month),
  );
  const totalFine = myFines.reduce((s, f) => s + f.amount, 0);

  return (
    <GradientBackground>
      <ScreenHeader
        title="My Fines"
        avatarName={user?.name}
        avatarUrl={user?.photoUrl}
        subtitle="Fine history and monthly total"
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
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 108 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PRIMARY]} tintColor={PRIMARY} />}
      >
        {/* Summary card */}
        <View style={{ marginTop: 16, marginBottom: 20 }}>
          {totalFine > 0 ? (
            <LinearGradient
              colors={[RED, "#E11D48"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.summaryCard}
            >
              <View style={styles.summaryIconWrap}>
                <Feather name="alert-circle" size={24} color="rgba(255,255,255,0.9)" />
              </View>
              <View style={styles.summaryText}>
                <Text style={styles.summaryLabelWhite}>Total Fine This Month</Text>
                <Text style={styles.summaryAmountWhite}>₹{totalFine.toFixed(2)}</Text>
                <Text style={styles.summaryNoteWhite}>
                  {myFines.length} fine{myFines.length !== 1 ? "s" : ""} · Added to your bill
                </Text>
              </View>
            </LinearGradient>
          ) : (
            <LinearGradient
              colors={[EMERALD, "#10B981"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.summaryCard}
            >
              <View style={styles.summaryIconWrap}>
                <Feather name="check-circle" size={24} color="rgba(255,255,255,0.9)" />
              </View>
              <View style={styles.summaryText}>
                <Text style={styles.summaryLabelWhite}>No Fines This Month</Text>
                <Text style={styles.summaryAmountWhite}>₹0</Text>
              </View>
            </LinearGradient>
          )}
        </View>

        {/* Section heading */}
        <View>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Fine Records — {monthLabel(month)}
          </Text>
        </View>

        {/* Fine list */}
        {myFines.length === 0 ? (
          <View>
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Feather name="check-circle" size={32} color={EMERALD} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Fines</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                You have no fines recorded for {monthLabel(month)}.
              </Text>
            </View>
          </View>
        ) : (
          myFines.map((fine, index) => (
            <View
              key={fine.id}
              style={{ marginBottom: 12 }}
            >
              <View style={styles.fineCard}>
                <View style={styles.fineCardTop}>
                  <View style={styles.fineIconWrap}>
                    <LinearGradient colors={[RED, "#E11D48"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fineIconGradient}>
                      <Feather name="alert-circle" size={18} color="#fff" />
                    </LinearGradient>
                  </View>
                  <View style={styles.fineInfo}>
                    <Text style={[styles.fineReason, { color: colors.foreground }]}>{fine.reason || "Fine"}</Text>
                    <Text style={[styles.fineDate, { color: colors.mutedForeground }]}>{fine.date}</Text>
                  </View>
                  <View style={styles.fineAmountBadge}>
                    <Text style={styles.fineAmount}>₹{fine.amount.toFixed(0)}</Text>
                  </View>
                </View>
                {fine.notes ? (
                  <View style={[styles.fineNotes, { borderTopColor: colors.border }]}>
                    <Feather name="file-text" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.fineNotesText, { color: colors.mutedForeground }]}>{fine.notes}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ))
        )}

        {totalFine > 0 && (
          <View>
            <View style={styles.infoBox}>
              <Feather name="info" size={14} color={PRIMARY} />
              <Text style={[styles.infoText, { color: colors.foreground }]}>
                Fines are applied when the minimum required meals are not consumed. Contact admin for details.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    flexDirection: "row", alignItems: "center", gap: 16,
    borderRadius: 24, padding: 22,
    shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2, shadowRadius: 16, elevation: 8,
  },
  summaryIconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  summaryText: { flex: 1 },
  summaryLabelWhite: { fontSize: 13, fontWeight: "600", marginBottom: 4, color: "rgba(255,255,255,0.85)" },
  summaryAmountWhite: { fontSize: 34, fontWeight: "800", color: "#fff" },
  summaryNoteWhite: { fontSize: 12, marginTop: 4, color: "rgba(255,255,255,0.8)" },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 14 },
  emptyState: { alignItems: "center", paddingTop: 32, paddingBottom: 24, gap: 12 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#34D399", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 5,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyText: { fontSize: 14, textAlign: "center", paddingHorizontal: 24 },
  fineCard: {
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.6)",
    shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 3,
    overflow: "hidden",
  },
  fineCardTop: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  fineIconWrap: { width: 44, height: 44, borderRadius: 12, overflow: "hidden" },
  fineIconGradient: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  fineInfo: { flex: 1 },
  fineReason: { fontSize: 15, fontWeight: "700" },
  fineDate: { fontSize: 12, marginTop: 3 },
  fineAmountBadge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: `${RED}15` },
  fineAmount: { fontSize: 15, fontWeight: "800", color: RED },
  fineNotes: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1,
  },
  fineNotesText: { flex: 1, fontSize: 12, lineHeight: 17 },
  infoBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    borderRadius: 16, padding: 14, marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.6)",
  },
  infoText: { flex: 1, fontSize: 13, lineHeight: 18 },
  headerMonthNav: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", paddingVertical: 4,
  },
  headerNavBtn: { padding: 8 },
  headerMonthText: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: "#fff" },
});
