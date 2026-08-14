import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useState } from "react";
import { ScreenHeader } from "@/components/ScreenHeader";
import {
  Alert,
  FlatList,
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

import { Expense, useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";
import { useRefresh } from "@/hooks/useRefresh";
import { BG_GRADIENT, PRIMARY } from "@/constants/colors";

const CATEGORIES = [
  { key: "all",       label: "All",     icon: "list",            color: "#374151" },
  { key: "grocery",   label: "Grocery", icon: "shopping-bag",    color: "#2563EB" },
  { key: "vegetable", label: "Veg",     icon: "box",             color: "#16A34A" },
  { key: "fish",      label: "Fish",    icon: "droplet",         color: "#0891B2" },
  { key: "meat",      label: "Meat",    icon: "heart",           color: "#EF4444" },
  { key: "gas",       label: "Gas",     icon: "zap",             color: "#F59E0B" },
  { key: "other",     label: "Other",   icon: "more-horizontal", color: "#7C3AED" },
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

const EMPTY_FORM: Omit<Expense, "id"> = {
  type: "grocery", date: new Date().toISOString().slice(0, 10),
  shopName: "", items: "", amount: 0, notes: "",
};

export default function ExpensesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { expenses, addExpense, updateExpense, deleteExpense } = useData();
  const { refreshing, onRefresh } = useRefresh();
  const [month, setMonth] = useState(getCurrentMonth());
  const [category, setCategory] = useState("all");
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<Omit<Expense, "id">>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const monthExpenses = expenses.filter((e) => e.date.startsWith(month));
  const filtered =
    category === "all" ? monthExpenses : monthExpenses.filter((e) => e.type === category);
  const total = filtered.reduce((s, e) => s + e.amount, 0);
  const monthTotal = monthExpenses.reduce((s, e) => s + e.amount, 0);

  const openAdd = useCallback(() => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, date: `${month}-${String(new Date().getDate()).padStart(2, "0")}` });
    setModalVisible(true);
  }, [month]);

  const openEdit = useCallback((e: Expense) => {
    setEditing(e);
    setForm({
      type: e.type, date: e.date, shopName: e.shopName ?? "",
      items: e.items ?? "", amount: e.amount, notes: e.notes ?? "",
    });
    setModalVisible(true);
  }, []);

  const handleSave = async () => {
    if (!form.amount || form.amount <= 0) {
      Alert.alert("Validation Error", "Please enter a valid amount.");
      return;
    }
    if (!form.date.trim()) {
      Alert.alert("Validation Error", "Please enter a date.");
      return;
    }
    setIsSaving(true);
    try {
      if (editing) {
        await updateExpense(editing.id, form);
      } else {
        await addExpense(form);
      }
      setModalVisible(false);
    } catch (err) {
      Alert.alert("Save Failed", (err as Error).message || "Something went wrong.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = useCallback((e: Expense) => {
    Alert.alert("Delete", `Delete this expense (₹${e.amount})?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await deleteExpense(e.id);
          } catch (err) {
            Alert.alert("Delete Failed", (err as Error).message || "Could not delete expense.");
          }
        },
      },
    ]);
  }, [deleteExpense]);

  const getCatInfo = (type: string) =>
    CATEGORIES.find((c) => c.key === type) ?? CATEGORIES[CATEGORIES.length - 1];

  return (
    <LinearGradient colors={BG_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.screen}>
      <ScreenHeader
        title="Expenses"
        icon="dollar-sign"
        subtitle="Track mess expenses"
        bottomElement={
          <View style={styles.headerMonthNav}>
            <Pressable onPress={() => setMonth(prevMonth(month))} style={styles.headerNavBtn}>
              <Feather name="chevron-left" size={20} color="rgba(255,255,255,0.9)" />
            </Pressable>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={styles.headerMonthText}>{monthLabel(month)}</Text>
              <Text style={styles.headerMonthSub}>Total: ₹{monthTotal.toFixed(0)}</Text>
            </View>
            <Pressable onPress={() => setMonth(nextMonth(month))} style={styles.headerNavBtn}>
              <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.9)" />
            </Pressable>
          </View>
        }
      />

      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.catScroll}
        contentContainerStyle={styles.catContent}
      >
        {CATEGORIES.map((c) => (
          <Pressable
            key={c.key}
            style={[styles.catChip, { backgroundColor: category === c.key ? c.color : colors.card }]}
            onPress={() => setCategory(c.key)}
          >
            <Feather
              name={c.icon as "list"}
              size={14}
              color={category === c.key ? "#fff" : colors.mutedForeground}
            />
            <Text style={[
              styles.catChipText,
              { color: category === c.key ? "#fff" : colors.mutedForeground },
            ]}>
              {c.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {category !== "all" && (
        <View>
          <View style={[styles.filterTotal, { backgroundColor: colors.card }]}>
            <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>
              {CATEGORIES.find((c) => c.key === category)?.label} total:
            </Text>
            <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>
              ₹{total.toFixed(0)}
            </Text>
          </View>
        </View>
      )}

      <FlatList
        data={filtered.slice().reverse()}
        keyExtractor={(e) => e.id}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[PRIMARY]}
            tintColor={PRIMARY}
          />
        }
        removeClippedSubviews={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: "rgba(79,70,229,0.10)" }]}>
              <Feather name="dollar-sign" size={32} color={PRIMARY} />
            </View>
            <Text style={{ color: colors.mutedForeground, fontSize: 15 }}>
              No expenses found
            </Text>
          </View>
        }
        renderItem={({ item: e, index }) => {
          const cat = getCatInfo(e.type);
          return (
            <View
              style={{ marginBottom: 10 }}
            >
              <View style={[styles.expenseCard, { backgroundColor: colors.card }]}>
                <View style={[styles.expenseIcon, { backgroundColor: cat.color + "18" }]}>
                  <Feather name={cat.icon as "list"} size={20} color={cat.color} />
                </View>
                <View style={styles.expenseInfo}>
                  <Text style={[styles.expenseName, { color: colors.foreground }]}>
                    {cat.label}{e.shopName ? ` · ${e.shopName}` : ""}
                  </Text>
                  {e.items ? (
                    <Text style={[styles.expenseMeta, { color: colors.mutedForeground }]}>
                      {e.items}
                    </Text>
                  ) : null}
                  <Text style={[styles.expenseDate, { color: colors.mutedForeground }]}>
                    {e.date}
                  </Text>
                </View>
                <Text style={[styles.expenseAmount, { color: colors.foreground }]}>
                  ₹{e.amount}
                </Text>
                <View style={{ flexDirection: "column", gap: 4, marginLeft: 8 }}>
                  <Pressable onPress={() => openEdit(e)} style={styles.actionBtn}>
                    <Feather name="edit-2" size={16} color={colors.primary} />
                  </Pressable>
                  <Pressable onPress={() => handleDelete(e)} style={styles.actionBtn}>
                    <Feather name="trash-2" size={16} color={colors.destructive} />
                  </Pressable>
                </View>
              </View>
            </View>
          );
        }}
      />

      {/* Animated FAB */}
      <Pressable
        onPress={openAdd}
      >
        <View style={styles.fabWrapper}>
          <LinearGradient
            colors={[PRIMARY, "#7C3AED"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fab}
          >
            <Feather name="plus" size={24} color="#fff" />
          </LinearGradient>
        </View>
      </Pressable>

      {/* ── Modal ── */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalHeaderIcon, { backgroundColor: "rgba(79,70,229,0.10)" }]}>
                <Feather name={editing ? "edit-2" : "plus"} size={18} color={PRIMARY} />
              </View>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {editing ? "Edit Expense" : "Add Expense"}
              </Text>
              <Pressable onPress={() => setModalVisible(false)} hitSlop={8}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <View style={[styles.modalDivider, { backgroundColor: colors.border }]} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>CATEGORY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {CATEGORIES.slice(1).map((c) => (
                    <Pressable
                      key={c.key}
                      style={[
                        styles.catChip,
                        { backgroundColor: form.type === c.key ? c.color : colors.muted },
                      ]}
                      onPress={() => setForm((f) => ({ ...f, type: c.key as Expense["type"] }))}
                    >
                      <Text style={[
                        styles.catChipText,
                        { color: form.type === c.key ? "#fff" : colors.mutedForeground },
                      ]}>
                        {c.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>

              {[
                { label: "Date *",     key: "date",     placeholder: "YYYY-MM-DD" },
                { label: "Shop Name",  key: "shopName", placeholder: "optional" },
                { label: "Items",      key: "items",    placeholder: "what was purchased" },
                { label: "Notes",      key: "notes",    placeholder: "optional" },
              ].map(({ label, key, placeholder }) => (
                <View key={key} style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>{label}</Text>
                  <TextInput
                    style={[styles.formInput, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]}
                    placeholder={placeholder}
                    placeholderTextColor={colors.mutedForeground}
                    value={String((form as Record<string, unknown>)[key] ?? "")}
                    onChangeText={(v) => setForm((f) => ({ ...f, [key]: v }))}
                  />
                </View>
              ))}

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>AMOUNT (₹) *</Text>
                <TextInput
                  style={[styles.formInput, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]}
                  placeholder="0"
                  placeholderTextColor={colors.mutedForeground}
                  value={form.amount ? String(form.amount) : ""}
                  onChangeText={(v) => setForm((f) => ({ ...f, amount: parseFloat(v) || 0 }))}
                  keyboardType="numeric"
                />
              </View>

              <Pressable
                style={({ pressed }) => [{ opacity: (pressed || isSaving) ? 0.7 : 1, marginTop: 8, marginBottom: 20 }]}
                onPress={handleSave}
                disabled={isSaving}
              >
                <LinearGradient
                  colors={[PRIMARY, "#7C3AED"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.saveBtn}
                >
                  <Text style={styles.saveBtnText}>
                    {isSaving ? "Saving…" : editing ? "Update" : "Add Expense"}
                  </Text>
                </LinearGradient>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },
  catScroll: { flexGrow: 0, marginTop: 12 },
  catContent: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  catChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  catChipText: { fontSize: 13, fontWeight: "600" },
  filterTotal: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginHorizontal: 16, marginBottom: 12, borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.6)",
    shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10, shadowRadius: 16, elevation: 6,
  },
  expenseCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.6)",
    shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 3,
  },
  expenseIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  expenseInfo: { flex: 1 },
  expenseName: { fontSize: 15, fontWeight: "700" },
  expenseMeta: { fontSize: 13, marginTop: 1 },
  expenseDate: { fontSize: 11, marginTop: 4 },
  expenseAmount: { fontSize: 17, fontWeight: "700" },
  actionBtn: { padding: 6 },
  fabWrapper: {
    position: "absolute", right: 20, bottom: 100,
    shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45, shadowRadius: 12, elevation: 10,
  },
  fab: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: "center", justifyContent: "center",
  },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  empty: { alignItems: "center", paddingTop: 60, gap: 8 },
  modalOverlay: { flex: 1, backgroundColor: "#00000055", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: "92%" },
  modalHeader: {
    flexDirection: "row", alignItems: "center",
    gap: 12, marginBottom: 16,
  },
  modalHeaderIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  modalTitle: { flex: 1, fontSize: 20, fontWeight: "700" },
  modalDivider: { height: 1, marginBottom: 20 },
  formGroup: { marginBottom: 14 },
  formLabel: {
    fontSize: 11, fontWeight: "700", marginBottom: 6,
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  formInput: {
    borderWidth: 1.5,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16,
  },
  saveBtn: { borderRadius: 16, paddingVertical: 16, alignItems: "center" },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  headerMonthNav: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", paddingVertical: 4,
  },
  headerNavBtn: { padding: 8 },
  headerMonthText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  headerMonthSub: { fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 2 },
});
