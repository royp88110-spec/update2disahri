import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useRef, useState } from "react";
import { ScreenHeader } from "@/components/ScreenHeader";
import { MemberAvatar } from "@/components/MemberAvatar";
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

import { Member, useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";
import { useRefresh } from "@/hooks/useRefresh";
import { BG_GRADIENT, PRIMARY } from "@/constants/colors";

const EMPTY: Omit<Member, "id"> = {
  name: "", phone: "", email: "", roomNumber: "",
  joinDate: new Date().toISOString().slice(0, 10),
  status: "active", password: "",
};

// ─── MemberCard ───────────────────────────────────────────────────────────────

const MemberCard = React.memo(function MemberCard({
  member,
  colors,
  onEdit,
  onDelete,
  onToggleStatus,
}: {
  member: Member;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  onEdit: (m: Member) => void;
  onDelete: (m: Member) => void;
  onToggleStatus: (m: Member) => void;
}) {
  return (
    <View>
      <Pressable
        onLongPress={() => onEdit(member)}
      >
        <View style={[styles.memberCard, { backgroundColor: colors.card }]}>
          <MemberAvatar
            name={member.name}
            size={44}
            bgColor={member.status === "active" ? `${PRIMARY}20` : colors.muted}
            textColor={member.status === "active" ? PRIMARY : colors.mutedForeground}
          />
          <View style={styles.memberInfo}>
            <View style={styles.memberNameRow}>
              <Text style={[styles.memberName, { color: colors.foreground }]}>
                {member.name}
              </Text>
              <View style={[
                styles.statusBadge,
                { backgroundColor: member.status === "active" ? "#16A34A18" : "#EF444418" },
              ]}>
                <Text style={[
                  styles.statusText,
                  { color: member.status === "active" ? "#16A34A" : "#EF4444" },
                ]}>
                  {member.status}
                </Text>
              </View>
            </View>
            <Text style={[styles.memberPhone, { color: colors.mutedForeground }]}>
              {member.phone}{member.roomNumber ? ` · Room ${member.roomNumber}` : ""}
            </Text>
            <Text style={[styles.memberJoin, { color: colors.mutedForeground }]}>
              Joined: {member.joinDate}
            </Text>
          </View>
          <View style={styles.actions}>
            <Pressable onPress={() => onToggleStatus(member)} style={styles.actionBtn}>
              <Feather
                name={member.status === "active" ? "toggle-right" : "toggle-left"}
                size={20}
                color={colors.primary}
              />
            </Pressable>
            <Pressable onPress={() => onEdit(member)} style={styles.actionBtn}>
              <Feather name="edit-2" size={18} color={colors.primary} />
            </Pressable>
            <Pressable onPress={() => onDelete(member)} style={styles.actionBtn}>
              <Feather name="trash-2" size={18} color={colors.destructive} />
            </Pressable>
          </View>
        </View>
      </Pressable>
    </View>
  );
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MembersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { members, addMember, updateMember, deleteMember } = useData();
  const { refreshing, onRefresh } = useRefresh();
  const [search, setSearch] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [form, setForm] = useState<Omit<Member, "id">>(EMPTY);
  const [isSaving, setIsSaving] = useState(false);

  const filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.phone.includes(search),
  );

  const openAdd = useCallback(() => {
    setEditing(null);
    setForm(EMPTY);
    setModalVisible(true);
  }, []);

  const openEdit = useCallback((m: Member) => {
    setEditing(m);
    setForm({
      name: m.name, phone: m.phone, email: m.email ?? "",
      roomNumber: m.roomNumber ?? "", joinDate: m.joinDate,
      status: m.status, password: m.password,
    });
    setModalVisible(true);
  }, []);

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      Alert.alert("Validation Error", "Name and Phone are required.");
      return;
    }
    if (!editing && !form.password.trim()) {
      Alert.alert("Validation Error", "Password is required for new members.");
      return;
    }
    setIsSaving(true);
    try {
      if (editing) {
        await updateMember(editing.id, form);
      } else {
        await addMember(form);
      }
      setModalVisible(false);
    } catch (err) {
      Alert.alert("Save Failed", (err as Error).message || "Something went wrong.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = useCallback((m: Member) => {
    Alert.alert("Delete Member", `Delete ${m.name}? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await deleteMember(m.id);
          } catch (err) {
            Alert.alert("Delete Failed", (err as Error).message || "Could not delete member.");
          }
        },
      },
    ]);
  }, [deleteMember]);

  const toggleStatus = useCallback(async (m: Member) => {
    try {
      await updateMember(m.id, { status: m.status === "active" ? "inactive" : "active" });
    } catch (err) {
      Alert.alert("Error", (err as Error).message || "Could not update status.");
    }
  }, [updateMember]);

  return (
    <LinearGradient colors={BG_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.screen}>
      <ScreenHeader
        title="Members"
        icon="users"
        subtitle={`${members.length} total · ${members.filter((m) => m.status === "active").length} active`}
      />

      <View>
        <View style={[styles.searchBar, { backgroundColor: colors.card }]}>
          <View style={[styles.searchIcon, { backgroundColor: colors.muted }]}>
            <Feather name="search" size={16} color={colors.mutedForeground} />
          </View>
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search members…"
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(m) => m.id}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100, paddingHorizontal: 16 }}
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
              <Feather name="users" size={32} color={PRIMARY} />
            </View>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No members found
            </Text>
          </View>
        }
        renderItem={({ item: m, index }) => (
          <View
            style={{ marginBottom: 12 }}
          >
            <MemberCard
              member={m}
              colors={colors}
              onEdit={openEdit}
              onDelete={handleDelete}
              onToggleStatus={toggleStatus}
            />
          </View>
        )}
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
            <Feather name="user-plus" size={24} color="#fff" />
          </LinearGradient>
        </View>
      </Pressable>

      {/* ── Member Modal ── */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalHeaderIcon, { backgroundColor: "rgba(79,70,229,0.10)" }]}>
                <Feather name={editing ? "edit-2" : "user-plus"} size={18} color={PRIMARY} />
              </View>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {editing ? "Edit Member" : "Add Member"}
              </Text>
              <Pressable onPress={() => setModalVisible(false)} hitSlop={8}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <View style={[styles.modalDivider, { backgroundColor: colors.border }]} />

            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                { label: "Full Name *",    key: "name",       placeholder: "e.g. Rahul Ahmed" },
                { label: "Phone *",        key: "phone",      placeholder: "e.g. 01711111111", keyboard: "phone-pad" },
                { label: "Email",          key: "email",      placeholder: "optional",          keyboard: "email-address" },
                { label: "Room Number",    key: "roomNumber", placeholder: "e.g. 101" },
                { label: "Joining Date *", key: "joinDate",   placeholder: "YYYY-MM-DD" },
                { label: "Password *",     key: "password",   placeholder: "Login password" },
              ].map(({ label, key, placeholder, keyboard }) => (
                <View key={key} style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>{label}</Text>
                  <TextInput
                    style={[styles.formInput, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]}
                    placeholder={placeholder}
                    placeholderTextColor={colors.mutedForeground}
                    value={String((form as Record<string, unknown>)[key] ?? "")}
                    onChangeText={(v) => setForm((f) => ({ ...f, [key]: v }))}
                    keyboardType={(keyboard as "default") ?? "default"}
                    autoCapitalize="none"
                  />
                </View>
              ))}

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>Status</Text>
                <View style={styles.statusRow}>
                  {(["active", "inactive"] as const).map((s) => (
                    <Pressable
                      key={s}
                      style={[
                        styles.statusOpt,
                        {
                          borderColor: form.status === s ? PRIMARY : colors.border,
                          backgroundColor: form.status === s ? "rgba(79,70,229,0.08)" : colors.muted,
                        },
                      ]}
                      onPress={() => setForm((f) => ({ ...f, status: s }))}
                    >
                      <Text style={[
                        styles.statusOptText,
                        { color: form.status === s ? PRIMARY : colors.mutedForeground },
                      ]}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
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
                    {isSaving ? "Saving…" : editing ? "Update Member" : "Add Member"}
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
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 16, marginBottom: 16, marginTop: 12,
    borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.6)",
    shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 14, elevation: 4,
  },
  searchIcon: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  searchInput: { flex: 1, fontSize: 16 },
  memberCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.6)",
    shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 3,
  },
  memberInfo: { flex: 1 },
  memberNameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  memberName: { fontSize: 15, fontWeight: "700" },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: "700" },
  memberPhone: { fontSize: 13, marginTop: 3 },
  memberJoin: { fontSize: 11, marginTop: 2 },
  actions: { flexDirection: "row", gap: 2 },
  actionBtn: { padding: 8 },
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
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: "#00000055", justifyContent: "flex-end" },
  modalSheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, maxHeight: "92%",
  },
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
    fontSize: 12, fontWeight: "600", marginBottom: 6,
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  formInput: {
    borderWidth: 1.5,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16,
  },
  statusRow: { flexDirection: "row", gap: 10 },
  statusOpt: {
    flex: 1, borderWidth: 1.5, borderRadius: 12,
    paddingVertical: 12, alignItems: "center",
  },
  statusOptText: { fontSize: 14, fontWeight: "600" },
  saveBtn: { borderRadius: 16, paddingVertical: 16, alignItems: "center" },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
