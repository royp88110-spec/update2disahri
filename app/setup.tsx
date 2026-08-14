import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { getApiBase } from "@/context/AuthContext";

export default function SetupScreen() {
  const { refreshSetupStatus } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [adminName, setAdminName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSetup = async () => {
    if (!adminName.trim()) { setError("Admin name is required."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${getApiBase()}/api/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: adminName.trim(), password }),
      });
      const data = (await res.json()) as { error?: string; schemaNotReady?: boolean };
      if (!res.ok) {
        if (data.schemaNotReady) {
          // Tables don't exist — re-check status so AuthContext sets schemaNotReady
          // and the router redirects to the SQL setup screen.
          await refreshSetupStatus();
          return;
        }
        setError(data.error ?? "Setup failed. Please try again.");
        return;
      }
      await refreshSetupStatus();
      router.replace("/login");
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={["#FFF8F3", "#FFE4CC"]} style={styles.gradient}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[
            styles.container,
            { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <LinearGradient
              colors={["#E25C14", "#AD3806"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoCircle}
            >
              <Feather name="coffee" size={36} color="#fff" />
            </LinearGradient>
            <Text style={styles.appName}>Dishari Mess</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              First Launch Setup
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Create Admin Account</Text>
            <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>
              Only one admin account is allowed. You will use these credentials to log in.
            </Text>

            <View style={styles.inputWrap}>
              <Feather name="user" size={18} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="Admin Name (e.g. Mess Admin)"
                placeholderTextColor={colors.mutedForeground}
                value={adminName}
                onChangeText={setAdminName}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputWrap}>
              <Feather name="lock" size={18} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="Password (min 6 characters)"
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable onPress={() => setShowPass(!showPass)}>
                <Feather name={showPass ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <View style={styles.inputWrap}>
              <Feather name="check-circle" size={18} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="Confirm Password"
                placeholderTextColor={colors.mutedForeground}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPass}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {error ? (
              <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
            ) : null}

            <Pressable
              style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1, marginTop: 4 }]}
              onPress={handleSetup}
              disabled={loading}
            >
              <LinearGradient colors={["#E25C14", "#AD3806"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submitBtn}>
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Create Admin Account</Text>
                )}
              </LinearGradient>
            </Pressable>
          </View>

          <View style={styles.note}>
            <Feather name="info" size={14} color={colors.mutedForeground} />
            <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
              Login ID will be: <Text style={{ fontWeight: "700" }}>admin</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  flex: { flex: 1 },
  container: { paddingHorizontal: 24, flexGrow: 1, justifyContent: "center" },
  header: { alignItems: "center", marginBottom: 32 },
  logoCircle: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: "center", justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#D4500A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  appName: { fontSize: 32, fontWeight: "800", letterSpacing: -0.5, color: "#D4500A" },
  subtitle: { fontSize: 14, marginTop: 4 },
  card: {
    borderRadius: 24, padding: 24, gap: 16,
    shadowColor: "#C04000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 14, elevation: 4,
  },
  cardTitle: { fontSize: 24, fontWeight: "800" },
  cardDesc: { fontSize: 13, lineHeight: 18, marginBottom: 4 },
  inputWrap: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#FFF4EE", borderWidth: 1.5, borderColor: "#EDE0D8", 
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13,
  },
  input: { flex: 1, fontSize: 16 },
  errorText: { fontSize: 13, marginTop: -4 },
  submitBtn: {
    borderRadius: 16, paddingVertical: 16,
    alignItems: "center", justifyContent: "center",
  },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  note: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 20, justifyContent: "center" },
  noteText: { fontSize: 13 },
});