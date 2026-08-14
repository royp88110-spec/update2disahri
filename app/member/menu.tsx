/**
 * Member — Menu View
 * Reads from the weekly routine (Sun–Sat template) stored in Supabase.
 * Today's meals are derived from the routine for today's day-of-week.
 */

import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo, useState } from "react";
import {
  Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useData } from "@/context/DataContext";
import type { RoutineEntry } from "@/context/DataContext";
import { useRefresh } from "@/hooks/useRefresh";
import {
  BG_GRADIENT, CARD_SHADOW, GLASS_CARD, PRIMARY,
} from "@/constants/colors";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_SHORT    = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const DAY_FULL     = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MONTH_NAMES  = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function parseISO(s: string) {
  const [y,m,d] = s.split("-").map(Number); return new Date(y,m-1,d);
}
function currentYYYYMM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
function prevMonth(m: string) {
  const [y,mo] = m.split("-").map(Number);
  const d = new Date(y,mo-2,1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
function nextMonth(m: string) {
  const [y,mo] = m.split("-").map(Number);
  const d = new Date(y,mo,1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
function monthLabel(m: string) {
  const [y,mo] = m.split("-").map(Number);
  return `${MONTH_NAMES[mo-1]} ${y}`;
}
function daysInMonth(year: number, month: number) { return new Date(year, month, 0).getDate(); }
function firstWeekday(year: number, month: number) { return new Date(year, month-1, 1).getDay(); }

// ─── Meal config ──────────────────────────────────────────────────────────────

type MealType = "lunch" | "dinner" | "tiffin";

const MEAL_META: Record<MealType, { label: string; emoji: string; color: string; bg: string; dot: string }> = {
  lunch:  { label: "Lunch",  emoji: "🍛", color: "#F97316", bg: "#FFF7ED", dot: "#F97316" },
  dinner: { label: "Dinner", emoji: "🌙", color: PRIMARY,   bg: "#EDE9FE", dot: PRIMARY   },
  tiffin: { label: "Tiffin", emoji: "🍱", color: "#0EA5E9", bg: "#F0F9FF", dot: "#0EA5E9" },
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ w, h, r = 8 }: { w: number | string; h: number; r?: number }) {
  return <View style={{ width: w as number, height: h, borderRadius: r, backgroundColor: "rgba(0,0,0,0.07)", marginVertical: 3 }} />;
}

// ─── Single meal card ─────────────────────────────────────────────────────────

function MealCard({ entry, mealType }: { entry: RoutineEntry | undefined; mealType: MealType }) {
  const meta = MEAL_META[mealType];
  const hasItems = (entry?.items.length ?? 0) > 0;

  return (
    <View style={[cardStyles.card, GLASS_CARD, CARD_SHADOW]}>
      <View style={[cardStyles.strip, { backgroundColor: meta.color }]} />
      <View style={cardStyles.body}>
        <View style={cardStyles.header}>
          <View style={[cardStyles.iconCircle, { backgroundColor: meta.bg }]}>
            <Text style={cardStyles.mealEmoji}>{meta.emoji}</Text>
          </View>
          <Text style={[cardStyles.mealLabel, { color: meta.color }]}>{meta.label}</Text>
          {entry?.isSpecial && (
            <View style={cardStyles.specialBadge}>
              <Text style={cardStyles.specialText}>✨ Special</Text>
            </View>
          )}
        </View>

        {entry?.isSpecial && entry.specialLabel ? (
          <Text style={cardStyles.specialEvent}>{entry.specialLabel}</Text>
        ) : null}

        {hasItems ? (
          <View style={cardStyles.itemsList}>
            {entry!.items.map((item, idx) => (
              <View key={idx} style={cardStyles.itemRow}>
                <Text style={cardStyles.itemEmoji}>
                  {item.emoji || (item.isVeg ? "🥬" : "🍖")}
                </Text>
                <Text style={cardStyles.itemName}>{item.name}</Text>
                <View style={[
                  cardStyles.vegBadge,
                  { backgroundColor: item.isVeg ? "#D1FAE5" : "#FEE2E2" }
                ]}>
                  <Text style={[cardStyles.vegText, { color: item.isVeg ? "#047857" : "#B91C1C" }]}>
                    {item.isVeg ? "Veg" : "Non-Veg"}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={cardStyles.emptyText}>Menu not announced yet</Text>
        )}

        {entry?.updatedAt && (
          <Text style={cardStyles.updatedAt}>
            Updated {new Date(entry.updatedAt).toLocaleString("en-IN", {
              day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
            })}
          </Text>
        )}
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: { borderRadius: 20, overflow: "hidden", marginBottom: 12 },
  strip: { height: 4 },
  body: { padding: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  iconCircle: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  mealEmoji: { fontSize: 20 },
  mealLabel: { fontSize: 16, fontWeight: "800" },
  specialBadge: {
    backgroundColor: "#FEF9C3", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 1, borderColor: "#FDE047",
  },
  specialText: { fontSize: 10, fontWeight: "700", color: "#854D0E" },
  specialEvent: { fontSize: 12, color: "#92400E", fontStyle: "italic", marginBottom: 8 },
  itemsList: { gap: 7 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  itemEmoji: { fontSize: 18, width: 26, textAlign: "center" },
  itemName: { flex: 1, fontSize: 14, color: "#1E293B", fontWeight: "600" },
  vegBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  vegText: { fontSize: 10, fontWeight: "700" },
  emptyText: { fontSize: 13, color: "#94A3B8", fontStyle: "italic", paddingVertical: 6 },
  updatedAt: { fontSize: 10, color: "#94A3B8", marginTop: 8 },
});

// ─── Day view (entries for a given day-of-week) ───────────────────────────────

function DayView({
  dow, routine, isLoading,
}: {
  dow: number;
  routine: RoutineEntry[];
  isLoading: boolean;
}) {
  const entryFor = (mt: MealType) => routine.find((e) => e.dayOfWeek === dow && e.mealType === mt);

  if (isLoading) {
    return (
      <View style={{ gap: 10 }}>
        {[1,2,3].map((n) => (
          <View key={n} style={[GLASS_CARD, CARD_SHADOW, { borderRadius: 20, padding: 16 }]}>
            <Skeleton w="40%" h={18} />
            <Skeleton w="70%" h={14} />
            <Skeleton w="55%" h={14} />
          </View>
        ))}
      </View>
    );
  }

  const hasAny = (["lunch","dinner","tiffin"] as MealType[]).some((t) => entryFor(t));

  if (!hasAny) {
    return (
      <View style={dvStyles.emptyWrap}>
        <Text style={dvStyles.emptyIcon}>🍽️</Text>
        <Text style={dvStyles.emptyTitle}>No menu set for {DAY_FULL[dow]}</Text>
        <Text style={dvStyles.emptyHint}>The admin hasn't set a routine for this day yet.</Text>
      </View>
    );
  }

  return (
    <View>
      <Text style={dvStyles.sectionTitle}>🍳 Cooking Menu</Text>
      <MealCard mealType="lunch"  entry={entryFor("lunch")}  />
      <MealCard mealType="dinner" entry={entryFor("dinner")} />
      <Text style={[dvStyles.sectionTitle, { marginTop: 4 }]}>🍱 Tiffin Menu</Text>
      <MealCard mealType="tiffin" entry={entryFor("tiffin")} />
    </View>
  );
}

const dvStyles = StyleSheet.create({
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#4B5563", marginBottom: 8 },
  emptyWrap: {
    alignItems: "center", paddingVertical: 48,
    backgroundColor: "rgba(255,255,255,0.7)", borderRadius: 20,
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#374151", marginBottom: 6 },
  emptyHint: { fontSize: 13, color: "#6B7280", textAlign: "center", paddingHorizontal: 32 },
});

// ─── Calendar tab ─────────────────────────────────────────────────────────────

function CalendarTab({ routine }: { routine: RoutineEntry[] }) {
  const today = toISO(new Date());
  const [month, setMonth] = useState(currentYYYYMM);
  const [picked, setPicked] = useState<string | null>(null);

  const [year, mo] = month.split("-").map(Number);
  const totalDays  = daysInMonth(year, mo);
  const startDay   = firstWeekday(year, mo);

  // For each date, derive which meal types have a routine entry via day-of-week
  const routineByDow = useMemo(() => {
    const m = new Map<number, Set<string>>();
    routine.forEach((e) => {
      if (!m.has(e.dayOfWeek)) m.set(e.dayOfWeek, new Set());
      m.get(e.dayOfWeek)!.add(e.mealType);
    });
    return m;
  }, [routine]);

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const pickedDow = picked ? parseISO(picked).getDay() : null;

  return (
    <View>
      <View style={calStyles.monthNav}>
        <TouchableOpacity onPress={() => setMonth((m) => prevMonth(m))} style={calStyles.navBtn}>
          <Feather name="chevron-left" size={18} color={PRIMARY} />
        </TouchableOpacity>
        <Text style={calStyles.monthLabel}>{monthLabel(month)}</Text>
        <TouchableOpacity onPress={() => setMonth((m) => nextMonth(m))} style={calStyles.navBtn}>
          <Feather name="chevron-right" size={18} color={PRIMARY} />
        </TouchableOpacity>
      </View>

      <View style={[GLASS_CARD, CARD_SHADOW, { borderRadius: 20, padding: 12, marginBottom: 16 }]}>
        <View style={{ flexDirection: "row", marginBottom: 6 }}>
          {DAY_SHORT.map((n) => (
            <Text key={n} style={calStyles.dayName}>{n}</Text>
          ))}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {cells.map((day, idx) => {
            if (!day) return <View key={`p-${idx}`} style={calStyles.cell} />;
            const iso   = `${month}-${String(day).padStart(2,"0")}`;
            const dow   = parseISO(iso).getDay();
            const isT   = iso === today;
            const isSel = iso === picked;
            const types = routineByDow.get(dow);

            return (
              <TouchableOpacity
                key={iso}
                style={[calStyles.cell, isSel && calStyles.cellSel]}
                onPress={() => setPicked(isSel ? null : iso)}
                activeOpacity={0.7}
              >
                <View style={[calStyles.dateCircle, isT && calStyles.todayCircle]}>
                  <Text style={[calStyles.dateNum, isT && calStyles.todayNum, isSel && !isT && calStyles.selNum]}>
                    {day}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 2, height: 5, alignItems: "center", marginTop: 2 }}>
                  {types?.has("lunch")  && <View style={[calStyles.dot, { backgroundColor: MEAL_META.lunch.dot }]} />}
                  {types?.has("dinner") && <View style={[calStyles.dot, { backgroundColor: MEAL_META.dinner.dot }]} />}
                  {types?.has("tiffin") && <View style={[calStyles.dot, { backgroundColor: MEAL_META.tiffin.dot }]} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Legend */}
      <View style={{ flexDirection: "row", gap: 14, marginBottom: 16, paddingHorizontal: 4 }}>
        {(["lunch","dinner","tiffin"] as MealType[]).map((t) => (
          <View key={t} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: MEAL_META[t].dot }} />
            <Text style={{ fontSize: 11, color: "#64748B", fontWeight: "500" }}>{MEAL_META[t].label}</Text>
          </View>
        ))}
      </View>

      {picked && pickedDow !== null && (
        <View>
          <Text style={[dvStyles.sectionTitle, { fontSize: 15, color: "#1E1B4B", marginBottom: 12 }]}>
            {DAY_FULL[pickedDow]}{picked === today ? " · Today" : ""}
          </Text>
          <DayView dow={pickedDow} routine={routine} isLoading={false} />
        </View>
      )}
    </View>
  );
}

const calStyles = StyleSheet.create({
  monthNav: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10,
  },
  navBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.8)", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(79,70,229,0.15)",
  },
  monthLabel: { fontSize: 16, fontWeight: "800", color: "#1E1B4B" },
  dayName: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "700", color: "#6B7280" },
  cell: { width: `${100/7}%`, alignItems: "center", paddingVertical: 4 },
  cellSel: { backgroundColor: "rgba(79,70,229,0.08)", borderRadius: 10 },
  dateCircle: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  todayCircle: { backgroundColor: PRIMARY },
  dateNum: { fontSize: 12, fontWeight: "600", color: "#334155" },
  todayNum: { color: "#fff", fontWeight: "800" },
  selNum: { color: PRIMARY, fontWeight: "800" },
  dot: { width: 4, height: 4, borderRadius: 2 },
});

// ─── Tab pill ─────────────────────────────────────────────────────────────────

type ViewTab = "today" | "week" | "month";

function TabPill({
  tabs, active, onChange,
}: {
  tabs: { key: ViewTab; label: string }[];
  active: ViewTab;
  onChange: (t: ViewTab) => void;
}) {
  return (
    <View style={tabStyles.pill}>
      {tabs.map((t) => (
        <Pressable
          key={t.key}
          style={[tabStyles.item, active === t.key && tabStyles.itemActive]}
          onPress={() => onChange(t.key)}
        >
          <Text style={[tabStyles.label, active === t.key && tabStyles.labelActive]}>
            {t.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const tabStyles = StyleSheet.create({
  pill: {
    flexDirection: "row", backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: 14, padding: 3, gap: 2, marginBottom: 16,
    borderWidth: 1, borderColor: "rgba(79,70,229,0.1)",
  },
  item: { flex: 1, paddingVertical: 8, borderRadius: 11, alignItems: "center" },
  itemActive: { backgroundColor: PRIMARY },
  label: { fontSize: 13, fontWeight: "700", color: "#6B7280" },
  labelActive: { color: "#fff" },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

const TABS: { key: ViewTab; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week",  label: "This Week" },
  { key: "month", label: "Calendar" },
];

export default function MemberMenuScreen() {
  const insets = useSafeAreaInsets();
  const { menuRoutine, isLoaded } = useData();
  const { refreshing, onRefresh } = useRefresh();

  const [activeTab, setActiveTab] = useState<ViewTab>("today");
  const [weekDay, setWeekDay] = useState(() => new Date().getDay());

  const todayDow    = new Date().getDay();
  const tomorrowDow = (todayDow + 1) % 7;

  const todayDate    = toISO(new Date());
  const tomorrowDate = toISO(new Date(Date.now() + 86400000));

  const hasToday    = menuRoutine.some((e) => e.dayOfWeek === todayDow);
  const hasTomorrow = menuRoutine.some((e) => e.dayOfWeek === tomorrowDow);
  const hasSpecialToday = menuRoutine.some((e) => e.dayOfWeek === todayDow && e.isSpecial);

  const BOTTOM_PAD = 100 + insets.bottom;

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Today's Menu" icon="book-open" subtitle="Mess Kitchen" />

      <LinearGradient colors={BG_GRADIENT} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[scStyles.scroll, { paddingBottom: BOTTOM_PAD }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
        >
          <TabPill tabs={TABS} active={activeTab} onChange={setActiveTab} />

          {/* TODAY */}
          {activeTab === "today" && (
            <View>
              <LinearGradient
                colors={["#4F46E5","#7C3AED"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={scStyles.todayBanner}
              >
                <Text style={scStyles.bannerEmoji}>🍽️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={scStyles.bannerTitle}>Today's Menu</Text>
                  <Text style={scStyles.bannerDate}>{DAY_FULL[todayDow]}, {todayDate.split("-").slice(1).reverse().join(" ")}</Text>
                </View>
                {hasSpecialToday && (
                  <View style={scStyles.specialToday}>
                    <Text style={scStyles.specialTodayText}>✨ Special Today!</Text>
                  </View>
                )}
              </LinearGradient>

              <DayView dow={todayDow} routine={menuRoutine} isLoading={!isLoaded} />

              {/* Tomorrow preview */}
              {isLoaded && hasTomorrow && (
                <View style={scStyles.tomorrowSection}>
                  <View style={scStyles.tomorrowHeader}>
                    <Feather name="sunrise" size={14} color="#F97316" />
                    <Text style={scStyles.tomorrowTitle}>
                      Tomorrow — {DAY_FULL[tomorrowDow]}
                    </Text>
                  </View>
                  <DayView dow={tomorrowDow} routine={menuRoutine} isLoading={false} />
                </View>
              )}
            </View>
          )}

          {/* THIS WEEK */}
          {activeTab === "week" && (
            <View>
              {/* Day selector */}
              <ScrollView
                horizontal showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 16 }}
                contentContainerStyle={{ gap: 8, paddingRight: 8 }}
              >
                {DAY_SHORT.map((dayName, dow) => {
                  const isActive  = dow === weekDay;
                  const isToday   = dow === todayDow;
                  const hasMenu   = menuRoutine.some((e) => e.dayOfWeek === dow);

                  return (
                    <TouchableOpacity
                      key={dow}
                      onPress={() => setWeekDay(dow)}
                      style={[
                        wStyles.dayChip,
                        isActive && wStyles.dayChipActive,
                        isToday && !isActive && wStyles.dayChipToday,
                      ]}
                    >
                      <Text style={[wStyles.dayShort, isActive && { color: "#fff" }]}>
                        {dayName}
                      </Text>
                      {hasMenu && (
                        <View style={[wStyles.hasDot, isActive && { backgroundColor: "rgba(255,255,255,0.6)" }]} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={scStyles.weekLabelRow}>
                <Text style={scStyles.weekDayLabel}>{DAY_FULL[weekDay]}</Text>
                {weekDay === todayDow && (
                  <View style={scStyles.todayPill}><Text style={scStyles.todayPillText}>Today</Text></View>
                )}
              </View>
              <DayView dow={weekDay} routine={menuRoutine} isLoading={!isLoaded} />
            </View>
          )}

          {/* CALENDAR */}
          {activeTab === "month" && (
            <CalendarTab routine={menuRoutine} />
          )}
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const scStyles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingTop: 16 },

  todayBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 20, padding: 16, marginBottom: 16,
  },
  bannerEmoji: { fontSize: 32 },
  bannerTitle: { fontSize: 18, fontWeight: "800", color: "#fff" },
  bannerDate:  { fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 2 },
  specialToday: {
    backgroundColor: "#FEF9C3", borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: "#FDE047",
  },
  specialTodayText: { fontSize: 11, fontWeight: "800", color: "#854D0E" },

  tomorrowSection: { marginTop: 12 },
  tomorrowHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  tomorrowTitle: { fontSize: 14, fontWeight: "700", color: "#F97316" },

  weekLabelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  weekDayLabel: { fontSize: 15, fontWeight: "700", color: "#1E1B4B" },
  todayPill: {
    backgroundColor: "#EDE9FE", borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  todayPillText: { fontSize: 11, fontWeight: "700", color: PRIMARY },
});

const wStyles = StyleSheet.create({
  dayChip: {
    minWidth: 52, alignItems: "center", paddingVertical: 12, paddingHorizontal: 10,
    borderRadius: 14, backgroundColor: "rgba(255,255,255,0.8)",
    borderWidth: 1, borderColor: "rgba(79,70,229,0.12)", gap: 4,
  },
  dayChipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  dayChipToday:  { borderColor: PRIMARY, borderWidth: 2 },
  dayShort: { fontSize: 12, fontWeight: "700", color: "#6B7280" },
  hasDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: PRIMARY, marginTop: 2 },
});
