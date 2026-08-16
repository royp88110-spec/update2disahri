/**
 * Admin — Weekly Menu Routine
 * Define Sun–Sat meals once. The routine repeats every week automatically.
 * Any change applies to all future weeks instantly.
 */

import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView,
  Modal, Platform, Pressable, RefreshControl, ScrollView,
  StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";
import { PremiumCard } from "@/components/PremiumCard";
import { useData } from "@/context/DataContext";
import type { RoutineEntry, MenuItem } from "@/context/DataContext";
import { useRefresh } from "@/hooks/useRefresh";
import {
  BG_GRADIENT, CARD_SHADOW, GLASS_CARD, PRIMARY, YELLOW,
} from "@/constants/colors";

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_SHORT  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const DAY_FULL   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

type MealType = "lunch" | "dinner" | "tiffin";

const MEAL_META: Record<MealType, { label: string; emoji: string; color: string; bg: string; dot: string }> = {
  lunch:  { label: "Lunch",  emoji: "🍛", color: "#F97316", bg: "#FFF7ED", dot: "#F97316" },
  dinner: { label: "Dinner", emoji: "🌙", color: PRIMARY,   bg: "#EDE9FE", dot: PRIMARY   },
  tiffin: { label: "Tiffin", emoji: "🍱", color: "#0EA5E9", bg: "#F0F9FF", dot: "#0EA5E9" },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ItemDraft {
  _key: string;
  name: string;
  emoji: string;
  isVeg: boolean;
  notes: string;
}

interface ModalState {
  dayOfWeek: number;
  mealType: MealType;
  existingId: string | null;
  items: ItemDraft[];
  isSpecial: boolean;
  specialLabel: string;
}

// ─── Item Row (inside modal) ──────────────────────────────────────────────────

function ItemRow({
  item, onChange, onDelete,
}: {
  item: ItemDraft;
  onChange: (f: Partial<ItemDraft>) => void;
  onDelete: () => void;
}) {
  return (
    <View style={iStyles.row}>
      <TextInput
        style={iStyles.emojiInput}
        value={item.emoji}
        onChangeText={(v) => onChange({ emoji: v })}
        placeholder="🍚"
        maxLength={2}
      />
      <TextInput
        style={iStyles.nameInput}
        value={item.name}
        onChangeText={(v) => onChange({ name: v })}
        placeholder="Food name"
        returnKeyType="done"
      />
      <TouchableOpacity
        onPress={() => onChange({ isVeg: !item.isVeg })}
        style={[iStyles.vegBtn, {
          backgroundColor: item.isVeg ? "#D1FAE5" : "#FEE2E2",
          borderColor: item.isVeg ? "#10B981" : "#F43F5E",
        }]}
      >
        <Text style={{ fontSize: 11, fontWeight: "700", color: item.isVeg ? "#047857" : "#B91C1C" }}>
          {item.isVeg ? "🥦 Veg" : "🍖 Non"}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDelete} style={iStyles.delBtn} hitSlop={8}>
        <Feather name="trash-2" size={15} color="#F43F5E" />
      </TouchableOpacity>
    </View>
  );
}

const iStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  emojiInput: {
    width: 38, height: 38, borderRadius: 10, textAlign: "center",
    fontSize: 20, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0",
  },
  nameInput: {
    flex: 1, height: 38, borderRadius: 10, paddingHorizontal: 10,
    fontSize: 14, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0",
  },
  vegBtn: {
    height: 32, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  delBtn: { padding: 6 },
});

// ─── Meal Card ────────────────────────────────────────────────────────────────

function MealCard({
  mealType, entry, onEdit, onDelete, loading,
}: {
  mealType: MealType;
  entry: RoutineEntry | undefined;
  onEdit: () => void;
  onDelete: () => void;
  loading: boolean;
}) {
  const meta = MEAL_META[mealType];
  const hasItems = (entry?.items?.length ?? 0) > 0;

  return (
    <PremiumCard
      tone={mealType === "lunch" ? "butterCream" : mealType === "dinner" ? "lavenderRose" : "skyMint"}
      style={[mcStyles.card, GLASS_CARD, CARD_SHADOW]}
    >
      {/* Colored accent strip */}
      <View style={[mcStyles.strip, { backgroundColor: meta.color }]} />

      <View style={mcStyles.body}>
        {/* Header row */}
        <View style={mcStyles.header}>
          <View style={[mcStyles.iconCircle, { backgroundColor: meta.bg }]}>
            <Text style={mcStyles.mealEmoji}>{meta.emoji}</Text>
          </View>
          <Text style={[mcStyles.mealLabel, { color: meta.color }]}>{meta.label}</Text>
          {entry?.isSpecial && (
            <View style={mcStyles.specialBadge}>
              <Text style={mcStyles.specialText}>✨ Special</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          {entry && (
            <TouchableOpacity onPress={onDelete} hitSlop={8} style={{ padding: 6 }}>
              <Feather name="trash-2" size={14} color="#F43F5E" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={onEdit}
            style={[mcStyles.editBtn, { backgroundColor: meta.bg, borderColor: `${meta.color}40` }]}
          >
            <Feather name={entry ? "edit-2" : "plus"} size={13} color={meta.color} />
            <Text style={[mcStyles.editBtnText, { color: meta.color }]}>
              {entry ? "Edit" : "Add"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Special label */}
        {entry?.isSpecial && entry.specialLabel ? (
          <Text style={mcStyles.specialLabel}>{entry.specialLabel}</Text>
        ) : null}

        {/* Items */}
        {loading ? (
          <View style={{ gap: 6, paddingVertical: 4 }}>
            {[80, 60].map((w) => (
              <View key={w} style={{ width: `${w}%`, height: 14, borderRadius: 7, backgroundColor: "rgba(0,0,0,0.06)" }} />
            ))}
          </View>
        ) : hasItems ? (
          <View style={mcStyles.itemsList}>
            {entry!.items.map((item, idx) => (
              <View key={idx} style={mcStyles.itemRow}>
                <Text style={mcStyles.itemEmoji}>
                  {item.emoji || (item.isVeg ? "🥬" : "🍖")}
                </Text>
                <Text style={mcStyles.itemName} numberOfLines={1}>{item.name}</Text>
                <View style={[mcStyles.vegTag, { backgroundColor: item.isVeg ? "#D1FAE5" : "#FEE2E2" }]}>
                  <Text style={[mcStyles.vegTagText, { color: item.isVeg ? "#047857" : "#B91C1C" }]}>
                    {item.isVeg ? "Veg" : "Non-Veg"}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={mcStyles.emptyText}>No menu set — tap Add to fill this slot</Text>
        )}

        {entry?.updatedAt && (
          <Text style={mcStyles.updatedAt}>
            Updated {new Date(entry.updatedAt).toLocaleString("en-IN", {
              day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
            })}
          </Text>
        )}
      </View>
    </PremiumCard>
  );
}

const mcStyles = StyleSheet.create({
  card: { borderRadius: 18, overflow: "hidden", marginBottom: 12 },
  strip: { height: 3 },
  body: { padding: 14 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  iconCircle: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  mealEmoji: { fontSize: 18 },
  mealLabel: { fontSize: 15, fontWeight: "700" },
  specialBadge: {
    backgroundColor: "#FEF9C3", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: "#FDE047",
  },
  specialText: { fontSize: 10, fontWeight: "700", color: "#854D0E" },
  specialLabel: { fontSize: 12, color: "#92400E", marginBottom: 6, fontStyle: "italic" },
  editBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 10, borderWidth: 1,
  },
  editBtnText: { fontSize: 12, fontWeight: "700" },
  itemsList: { gap: 6 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  itemEmoji: { fontSize: 16, width: 22, textAlign: "center" },
  itemName: { flex: 1, fontSize: 14, color: "#334155", fontWeight: "500" },
  vegTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  vegTagText: { fontSize: 10, fontWeight: "700" },
  emptyText: { fontSize: 12, color: "#94A3B8", fontStyle: "italic", paddingVertical: 4 },
  updatedAt: { fontSize: 10, color: "#94A3B8", marginTop: 8 },
});

// ─── Day Selector ─────────────────────────────────────────────────────────────

function DaySelector({
  selected, menuRoutine, onChange,
}: {
  selected: number;
  menuRoutine: RoutineEntry[];
  onChange: (d: number) => void;
}) {
  const todayDow = new Date().getDay();

  return (
    <View style={dsStyles.row}>
      {DAY_SHORT.map((label, dow) => {
        const isActive  = dow === selected;
        const isToday   = dow === todayDow;
        const hasMenu   = menuRoutine.some((e) => e.dayOfWeek === dow);

        return (
          <TouchableOpacity
            key={dow}
            onPress={() => onChange(dow)}
            style={[
              dsStyles.chip,
              isActive && dsStyles.chipActive,
              isToday && !isActive && dsStyles.chipToday,
            ]}
            activeOpacity={0.7}
          >
            <Text style={[dsStyles.chipLabel, isActive && dsStyles.chipLabelActive]}>
              {label}
            </Text>
            {hasMenu && (
              <View style={[dsStyles.dot, isActive && dsStyles.dotActive]} />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const dsStyles = StyleSheet.create({
  row: {
    flexDirection: "row", gap: 6, marginBottom: 20,
    paddingHorizontal: 2,
  },
  chip: {
    flex: 1, alignItems: "center", paddingVertical: 10,
    borderRadius: 14, backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: 1, borderColor: "rgba(79,70,229,0.12)", gap: 4,
  },
  chipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  chipToday:  { borderColor: PRIMARY, borderWidth: 1.5 },
  chipLabel: { fontSize: 11, fontWeight: "700", color: "#6B7280" },
  chipLabelActive: { color: "#fff" },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: PRIMARY },
  dotActive: { backgroundColor: "rgba(255,255,255,0.7)" },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AdminMenuScreen() {
  const insets = useSafeAreaInsets();
  const { menuRoutine, setRoutineEntry, deleteRoutineEntry, isLoaded } = useData();
  const { refreshing, onRefresh } = useRefresh();

  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [modal, setModal]     = useState<ModalState | null>(null);
  const [saving, setSaving]   = useState(false);
  const keyCounter = useRef(0);
  const newKey = () => String(++keyCounter.current);

  // Entries for the selected day
  const entriesForDay = menuRoutine.filter((e) => e.dayOfWeek === selectedDay);
  const entryFor = (mt: MealType) => entriesForDay.find((e) => e.mealType === mt);

  // Open edit/add modal
  const openModal = useCallback((mealType: MealType, existing?: RoutineEntry) => {
    if (existing) {
      setModal({
        dayOfWeek: selectedDay,
        mealType,
        existingId: existing.id,
        items: existing.items.map((i) => ({
          _key: newKey(),
          name: i.name,
          emoji: i.emoji ?? "",
          isVeg: i.isVeg,
          notes: i.notes ?? "",
        })),
        isSpecial: existing.isSpecial,
        specialLabel: existing.specialLabel ?? "",
      });
    } else {
      setModal({
        dayOfWeek: selectedDay,
        mealType,
        existingId: null,
        items: [{ _key: newKey(), name: "", emoji: "", isVeg: true, notes: "" }],
        isSpecial: false,
        specialLabel: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay]);

  const updateItem = (key: string, patch: Partial<ItemDraft>) =>
    setModal((m) => m ? { ...m, items: m.items.map((i) => i._key === key ? { ...i, ...patch } : i) } : null);

  const removeItem = (key: string) =>
    setModal((m) => m ? { ...m, items: m.items.filter((i) => i._key !== key) } : null);

  const addItem = () =>
    setModal((m) => m ? { ...m, items: [...m.items, { _key: newKey(), name: "", emoji: "", isVeg: true, notes: "" }] } : null);

  const handleSave = async () => {
    if (!modal) return;
    const validItems = modal.items.filter((i) => i.name.trim());
    if (validItems.length === 0) {
      Alert.alert("No Items", "Add at least one food item before saving.");
      return;
    }
    setSaving(true);
    try {
      const items: MenuItem[] = validItems.map((i) => ({
        name: i.name.trim(),
        emoji: i.emoji.trim() || undefined,
        isVeg: i.isVeg,
        notes: i.notes.trim() || undefined,
      }));
      await setRoutineEntry(modal.dayOfWeek, modal.mealType, items, modal.isSpecial, modal.specialLabel.trim() || undefined);
      setModal(null);
    } catch (err) {
      Alert.alert("Error", (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (entry: RoutineEntry) => {
    const meta = MEAL_META[entry.mealType];
    Alert.alert(
      `Remove ${meta.label} from ${DAY_FULL[selectedDay]}?`,
      "This removes it from the weekly routine, so it won't appear on any future week.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove", style: "destructive",
          onPress: async () => {
            try { await deleteRoutineEntry(entry.id); }
            catch (e) { Alert.alert("Error", (e as Error).message); }
          },
        },
      ],
    );
  };

  const BOTTOM_PAD = 100 + insets.bottom;
  const todayDow = new Date().getDay();

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Weekly Routine" icon="repeat" subtitle="Sun – Sat · Repeats every week" />

      <LinearGradient colors={BG_GRADIENT} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: BOTTOM_PAD }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
        >
          {/* Info banner */}
          <View style={styles.infoBanner}>
            <Text style={styles.infoBannerIcon}>🔁</Text>
            <Text style={styles.infoBannerText}>
              Set each day's menu once. It repeats every week — changes apply to all future weeks instantly.
            </Text>
          </View>

          {/* Day selector */}
          <DaySelector
            selected={selectedDay}
            menuRoutine={menuRoutine}
            onChange={setSelectedDay}
          />

          {/* Day label */}
          <View style={styles.dayLabelRow}>
            <View style={[styles.dayLabelAccent, { backgroundColor: PRIMARY }]} />
            <Text style={styles.dayLabelText}>{DAY_FULL[selectedDay]}</Text>
            {selectedDay === todayDow && (
              <View style={styles.todayChip}>
                <Text style={styles.todayChipText}>Today</Text>
              </View>
            )}
          </View>

          {/* Meal cards */}
          <Text style={styles.sectionTitle}>🍳 Cooking Menu</Text>
          <MealCard
            mealType="lunch"
            entry={entryFor("lunch")}
            onEdit={() => openModal("lunch",  entryFor("lunch"))}
            onDelete={() => { const e = entryFor("lunch"); if (e) handleDelete(e); }}
            loading={!isLoaded}
          />
          <MealCard
            mealType="dinner"
            entry={entryFor("dinner")}
            onEdit={() => openModal("dinner", entryFor("dinner"))}
            onDelete={() => { const e = entryFor("dinner"); if (e) handleDelete(e); }}
            loading={!isLoaded}
          />

          <Text style={[styles.sectionTitle, { marginTop: 4 }]}>🍱 Tiffin Menu</Text>
          <MealCard
            mealType="tiffin"
            entry={entryFor("tiffin")}
            onEdit={() => openModal("tiffin", entryFor("tiffin"))}
            onDelete={() => { const e = entryFor("tiffin"); if (e) handleDelete(e); }}
            loading={!isLoaded}
          />

          {/* Routine overview mini-grid */}
          <PremiumCard tone="lavenderCream" style={styles.overviewCard}>
            <Text style={styles.overviewTitle}>Routine Overview</Text>
            <View style={styles.overviewGrid}>
              {DAY_SHORT.map((day, dow) => {
                const lunch  = menuRoutine.some((e) => e.dayOfWeek === dow && e.mealType === "lunch");
                const dinner = menuRoutine.some((e) => e.dayOfWeek === dow && e.mealType === "dinner");
                const tiffin = menuRoutine.some((e) => e.dayOfWeek === dow && e.mealType === "tiffin");
                const isActive = dow === selectedDay;
                return (
                  <TouchableOpacity
                    key={dow}
                    style={[styles.overviewCell, isActive && styles.overviewCellActive]}
                    onPress={() => setSelectedDay(dow)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.overviewDay, isActive && styles.overviewDayActive]}>{day}</Text>
                    <View style={styles.overviewDots}>
                      <View style={[styles.overviewDot, { backgroundColor: lunch  ? "#F97316" : "#E2E8F0" }]} />
                      <View style={[styles.overviewDot, { backgroundColor: dinner ? PRIMARY  : "#E2E8F0" }]} />
                      <View style={[styles.overviewDot, { backgroundColor: tiffin ? "#0EA5E9" : "#E2E8F0" }]} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.overviewLegend}>
              {([["#F97316","Lunch"],["#4F46E5","Dinner"],["#0EA5E9","Tiffin"]] as [string,string][]).map(([c,l]) => (
                <View key={l} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} />
                  <Text style={{ fontSize: 10, color: "#64748B", fontWeight: "500" }}>{l}</Text>
                </View>
              ))}
            </View>
          </PremiumCard>
        </ScrollView>
      </LinearGradient>

      {/* Add/Edit Modal */}
      {modal && (
        <Modal
          visible
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setModal(null)}
        >
          <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: "#fff" }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <LinearGradient
              colors={["#4F46E5", "#7C3AED"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={[styles.modalHeader, { paddingTop: insets.top + 16 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  {MEAL_META[modal.mealType].emoji} {MEAL_META[modal.mealType].label} — {DAY_FULL[modal.dayOfWeek]}
                </Text>
                <Text style={styles.modalSubtitle}>Every {DAY_FULL[modal.dayOfWeek]}</Text>
              </View>
              <TouchableOpacity onPress={() => setModal(null)} style={styles.modalClose}>
                <Feather name="x" size={20} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.modalBody}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.modalSectionLabel}>Food Items</Text>
              <Text style={styles.modalHint}>Tap the emoji box to add an icon. Toggle Veg/Non-Veg on each item.</Text>

              {modal.items.map((item) => (
                <ItemRow
                  key={item._key}
                  item={item}
                  onChange={(f) => updateItem(item._key, f)}
                  onDelete={() => removeItem(item._key)}
                />
              ))}

              <TouchableOpacity style={styles.addItemBtn} onPress={addItem}>
                <Feather name="plus-circle" size={16} color={PRIMARY} />
                <Text style={styles.addItemText}>Add Item</Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              <View style={styles.specialRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.specialRowLabel}>✨ Special Menu</Text>
                  <Text style={styles.specialRowHint}>For festivals or regular special days</Text>
                </View>
                <Switch
                  value={modal.isSpecial}
                  onValueChange={(v) => setModal((m) => m ? { ...m, isSpecial: v } : null)}
                  trackColor={{ false: "#E2E8F0", true: `${YELLOW}80` }}
                  thumbColor={modal.isSpecial ? YELLOW : "#fff"}
                />
              </View>
              {modal.isSpecial && (
                <TextInput
                  style={styles.specialLabelInput}
                  value={modal.specialLabel}
                  onChangeText={(v) => setModal((m) => m ? { ...m, specialLabel: v } : null)}
                  placeholder='e.g. "Sunday Feast" or "Friday Special"'
                  returnKeyType="done"
                />
              )}
            </ScrollView>

            <View style={[styles.modalFooter, { paddingBottom: insets.bottom + 12 }]}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModal(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Feather name="check" size={16} color="#fff" />}
                <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save"}</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingTop: 16 },

  infoBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: "rgba(79,70,229,0.07)", borderRadius: 14,
    padding: 12, marginBottom: 18, borderWidth: 1, borderColor: "rgba(79,70,229,0.15)",
  },
  infoBannerIcon: { fontSize: 18, marginTop: 1 },
  infoBannerText: { flex: 1, fontSize: 13, color: "#374151", fontWeight: "500", lineHeight: 18 },

  dayLabelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  dayLabelAccent: { width: 4, height: 20, borderRadius: 2 },
  dayLabelText: { fontSize: 20, fontWeight: "800", color: "#1E1B4B" },
  todayChip: {
    backgroundColor: "#EDE9FE", borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  todayChipText: { fontSize: 11, fontWeight: "700", color: PRIMARY },

  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#4B5563", marginBottom: 10 },

  overviewCard: {
    ...GLASS_CARD, ...CARD_SHADOW, borderRadius: 20, padding: 16, marginTop: 8,
  },
  overviewTitle: { fontSize: 14, fontWeight: "700", color: "#1E1B4B", marginBottom: 12 },
  overviewGrid: { flexDirection: "row", gap: 6, marginBottom: 10 },
  overviewCell: {
    flex: 1, alignItems: "center", paddingVertical: 8,
    borderRadius: 12, backgroundColor: "#F8FAFC",
    borderWidth: 1, borderColor: "#E2E8F0", gap: 4,
  },
  overviewCellActive: { backgroundColor: "#EDE9FE", borderColor: PRIMARY },
  overviewDay: { fontSize: 10, fontWeight: "700", color: "#6B7280" },
  overviewDayActive: { color: PRIMARY },
  overviewDots: { flexDirection: "row", gap: 2 },
  overviewDot: { width: 6, height: 6, borderRadius: 3 },
  overviewLegend: { flexDirection: "row", gap: 12 },

  // Modal
  modalHeader: { padding: 20, flexDirection: "row", alignItems: "flex-start", gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#fff" },
  modalSubtitle: { fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 3 },
  modalClose: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center",
  },
  modalBody: { padding: 20, paddingBottom: 16 },
  modalSectionLabel: { fontSize: 15, fontWeight: "700", color: "#1E1B4B", marginBottom: 4 },
  modalHint: { fontSize: 12, color: "#64748B", marginBottom: 14 },
  addItemBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 12, borderRadius: 12,
    backgroundColor: "#EDE9FE", justifyContent: "center", marginTop: 4,
  },
  addItemText: { fontSize: 14, fontWeight: "700", color: PRIMARY },
  divider: { height: 1, backgroundColor: "#F1F5F9", marginVertical: 16 },
  specialRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  specialRowLabel: { fontSize: 14, fontWeight: "700", color: "#1E1B4B" },
  specialRowHint: { fontSize: 12, color: "#64748B", marginTop: 2 },
  specialLabelInput: {
    borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, backgroundColor: "#F8FAFC",
  },
  modalFooter: {
    flexDirection: "row", gap: 12, padding: 16,
    borderTopWidth: 1, borderTopColor: "#F1F5F9",
  },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14, borderWidth: 1,
    borderColor: "#E2E8F0", alignItems: "center",
  },
  cancelBtnText: { fontSize: 15, fontWeight: "700", color: "#64748B" },
  saveBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 14,
    backgroundColor: PRIMARY, flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 8,
  },
  saveBtnText: { fontSize: 15, fontWeight: "800", color: "#fff" },
});
