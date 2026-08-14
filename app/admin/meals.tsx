import { Feather } from "@expo/vector-icons";
import React, { useCallback, useRef, useState } from "react";
import { ScreenHeader } from "@/components/ScreenHeader";
import { MemberAvatar } from "@/components/MemberAvatar";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Member, useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";
import { useRefresh } from "@/hooks/useRefresh";
import { LinearGradient } from "expo-linear-gradient";
import { BG_GRADIENT, PRIMARY } from "@/constants/colors";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function displayDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

type RowColors = ReturnType<typeof useColors>;

// ─── MealToggleButton ─────────────────────────────────────────────────────────

function MealToggleButton({
  active,
  loading,
  color,
  onToggle,
}: {
  active: boolean;
  loading: boolean;
  color: string;
  onToggle: () => void;
}) {


  return (
    <Pressable
      onPress={onToggle}
      disabled={loading}
      hitSlop={8}
      style={styles.toggleCell}
    >
      <View
        style={[
          styles.toggleBtn,
          active
            ? { backgroundColor: color + "18", borderColor: color }
            : { backgroundColor: "#F1F5F9", borderColor: "#E2E8F0" },
          active && {
            shadowColor: color,
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.28,
            shadowRadius: 7,
            elevation: 4,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={color} />
        ) : (
          <View style={[styles.toggleIconCircle, { backgroundColor: active ? color : "#94A3B8" }]}>
            <Feather name={active ? "check" : "minus"} size={13} color="#fff" />
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ─── MemberRow ────────────────────────────────────────────────────────────────

const MemberRow = React.memo(function MemberRow({
  member,
  morning,
  night,
  toggle,
  colors,
}: {
  member: Member;
  morning: boolean;
  night: boolean;
  toggle: (memberId: string, type: "morning" | "night") => Promise<void>;
  colors: RowColors;
}) {
  const [morningLoading, setMorningLoading] = useState(false);
  const [nightLoading, setNightLoading] = useState(false);
  const morningInFlight = useRef(false);
  const nightInFlight = useRef(false);

  const handleToggle = useCallback(
    (type: "morning" | "night") => {
      const inFlight = type === "morning" ? morningInFlight : nightInFlight;
      if (inFlight.current) return;
      inFlight.current = true;
      const setLoading = type === "morning" ? setMorningLoading : setNightLoading;
      setLoading(true);
      toggle(member.id, type)
        .catch((err: Error) => {
          Alert.alert(
            "Sync Failed",
            err.message || "Meal toggle could not be saved. The display has been reverted.",
          );
        })
        .finally(() => {
          inFlight.current = false;
          setLoading(false);
        });
    },
    [member.id, toggle],
  );

  const total = (morning ? 1 : 0) + (night ? 1 : 0);

  return (
    <View style={styles.memberRow}>
      <MemberAvatar name={member.name} size={36} bgColor={`${PRIMARY}20`} textColor={PRIMARY} />
      <View style={styles.colMemberInfo}>
        <Text style={[styles.memberName, { color: colors.foreground }]} numberOfLines={1}>
          {member.name}
        </Text>
        {member.roomNumber ? (
          <Text style={[styles.memberRoom, { color: colors.mutedForeground }]}>
            Room {member.roomNumber}
          </Text>
        ) : null}
      </View>

      {/* Morning = Royal Blue, Night = Purple to keep visual distinction */}
      <MealToggleButton
        active={morning}
        loading={morningLoading}
        color={PRIMARY}
        onToggle={() => handleToggle("morning")}
      />
      <MealToggleButton
        active={night}
        loading={nightLoading}
        color="#7C3AED"
        onToggle={() => handleToggle("night")}
      />

      <View style={[styles.totalBadge, { backgroundColor: total > 0 ? `${PRIMARY}20` : colors.muted }]}>
        <Text style={[styles.totalText, { color: total > 0 ? PRIMARY : colors.mutedForeground }]}>
          {total}
        </Text>
      </View>
    </View>
  );
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MealsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { members, meals, setMeal, setMealsBatch } = useData();
  const { refreshing, onRefresh } = useRefresh();
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));

  const activeMembers = members.filter((m) => m.status === "active");

  const mealsRef = useRef(meals);
  mealsRef.current = meals;
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;
  const setMealRef = useRef(setMeal);
  setMealRef.current = setMeal;
  const setMealsBatchRef = useRef(setMealsBatch);
  setMealsBatchRef.current = setMealsBatch;
  const activeMembersRef = useRef(activeMembers);
  activeMembersRef.current = activeMembers;

  const toggle = useCallback(
    (memberId: string, type: "morning" | "night"): Promise<void> => {
      const date = selectedDateRef.current;
      const existing = mealsRef.current.find((m) => m.memberId === memberId && m.date === date);
      const morning = existing?.morning ?? false;
      const night = existing?.night ?? false;
      return setMealRef.current(
        memberId,
        date,
        type === "morning" ? !morning : morning,
        type === "night" ? !night : night,
      );
    },
    [],
  );

  const bulkMark = useCallback((type: "morning" | "night" | "clear") => {
    const date = selectedDateRef.current;
    const entries = activeMembersRef.current.map((m) => {
      const existing = mealsRef.current.find((r) => r.memberId === m.id && r.date === date);
      return {
        memberId: m.id,
        date,
        morning: type === "clear" ? false : type === "morning" ? true : existing?.morning ?? false,
        night:   type === "clear" ? false : type === "night"   ? true : existing?.night   ?? false,
      };
    });
    setMealsBatchRef.current(entries).catch((err: Error) => {
      Alert.alert("Sync Failed", err.message || "Bulk meal update could not be saved. The display has been reverted.");
    });
  }, []);

  const changeDate = (offset: number) => {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + offset);
    setSelectedDate(formatDate(d));
  };

  const todayMeals = meals.filter((m) => m.date === selectedDate);
  const totalMorning = todayMeals.filter((m) => m.morning).length;
  const totalNight = todayMeals.filter((m) => m.night).length;

  return (
    <LinearGradient colors={BG_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.screen}>
      <ScreenHeader
        title="Meal Entry"
        icon="grid"
        subtitle="Mark daily meals for members"
        bottomElement={
          <View style={styles.headerDateNav}>
            <Pressable onPress={() => changeDate(-1)} style={styles.headerNavBtn}>
              <Feather name="chevron-left" size={20} color="rgba(255,255,255,0.9)" />
            </Pressable>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={styles.headerDateText}>{displayDate(selectedDate)}</Text>
              <Text style={styles.headerDateSub}>
                Morning: {totalMorning} · Night: {totalNight}
              </Text>
            </View>
            <Pressable onPress={() => changeDate(1)} style={styles.headerNavBtn}>
              <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.9)" />
            </Pressable>
          </View>
        }
      />

      <View style={[styles.bulkBar, { backgroundColor: "rgba(255,255,255,0.92)" }]}>
        <Text style={[styles.bulkLabel, { color: colors.mutedForeground }]}>Bulk Mark</Text>
        <View style={styles.bulkBtns}>
          <Pressable
            style={[styles.bulkBtn, { backgroundColor: `${PRIMARY}18` }]}
            onPress={() => bulkMark("morning")}
          >
            <Text style={[styles.bulkBtnText, { color: PRIMARY }]}>All Morning</Text>
          </Pressable>
          <Pressable
            style={[styles.bulkBtn, { backgroundColor: "#7C3AED18" }]}
            onPress={() => bulkMark("night")}
          >
            <Text style={[styles.bulkBtnText, { color: "#7C3AED" }]}>All Night</Text>
          </Pressable>
          <Pressable
            style={[styles.bulkBtn, { backgroundColor: colors.muted }]}
            onPress={() => bulkMark("clear")}
          >
            <Text style={[styles.bulkBtnText, { color: colors.mutedForeground }]}>Clear All</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.tableHeader, { backgroundColor: colors.muted }]}>
        <Text style={[styles.colMember, { color: colors.mutedForeground }]}>MEMBER</Text>
        <Text style={[styles.colMeal, { color: PRIMARY }]}>MORNING</Text>
        <Text style={[styles.colMeal, { color: "#7C3AED" }]}>NIGHT</Text>
        <Text style={[styles.colTotal, { color: colors.mutedForeground }]}>TOTAL</Text>
      </View>

      <FlatList
        data={activeMembers}
        keyExtractor={(m) => m.id}
        style={{ flex: 1, backgroundColor: "transparent" }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[PRIMARY]}
            tintColor={PRIMARY}
          />
        }
        ItemSeparatorComponent={() => (
          <View style={{ height: 1, backgroundColor: "rgba(148,163,184,0.18)" }} />
        )}
        removeClippedSubviews={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="users" size={40} color={colors.muted} />
            <Text style={{ color: colors.mutedForeground, fontSize: 15 }}>No active members</Text>
          </View>
        }
        renderItem={({ item: m }) => {
          const meal = meals.find((r) => r.memberId === m.id && r.date === selectedDate);
          return (
            <MemberRow
              member={m}
              morning={meal?.morning ?? false}
              night={meal?.night ?? false}
              toggle={toggle}
              colors={colors}
            />
          );
        }}
      />
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerDateNav: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", paddingVertical: 4,
  },
  headerNavBtn: { padding: 8 },
  headerDateText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  headerDateSub: { fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  bulkBar: {
    marginHorizontal: 16, marginTop: 14, marginBottom: 12, borderRadius: 16,
    padding: 18,
    shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 14, elevation: 4,
  },
  bulkLabel: {
    fontSize: 11, fontWeight: "700", textTransform: "uppercase",
    letterSpacing: 0.5, marginBottom: 8,
  },
  bulkBtns: { flexDirection: "row", gap: 8 },
  bulkBtn: { flex: 1, borderRadius: 10, paddingVertical: 9, alignItems: "center" },
  bulkBtnText: { fontSize: 12, fontWeight: "700" },
  tableHeader: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 10, paddingHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  colMember: { flex: 1, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  colMeal: { width: 74, textAlign: "center", fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  colTotal: { width: 48, textAlign: "center", fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  memberRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 10,
    gap: 8,
  },
  colMemberInfo: { flex: 1 },
  memberName: { fontSize: 14, fontWeight: "600" },
  memberRoom: { fontSize: 11 },
  toggleCell: { width: 74, alignItems: "center" },
  toggleBtn: {
    width: 66, height: 38, borderRadius: 19,
    borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
  },
  toggleIconCircle: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: "center", justifyContent: "center",
  },
  totalBadge: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
  },
  totalText: { fontSize: 15, fontWeight: "700" },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
});
