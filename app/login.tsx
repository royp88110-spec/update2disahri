import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { BG_GRADIENT, PRIMARY, PRIMARY2 } from "@/constants/colors";

export default function LoginScreen() {
  const { login, user, isLoading, needsSetup } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const screenOpacity = useRef(new Animated.Value(1)).current;
  const screenTranslateY = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.82)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerTranslateY = useRef(new Animated.Value(16)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(28)).current;
  const cardScale = useRef(new Animated.Value(0.97)).current;
  const phoneOpacity = useRef(new Animated.Value(0)).current;
  const phoneTranslateY = useRef(new Animated.Value(12)).current;
  const passwordOpacity = useRef(new Animated.Value(0)).current;
  const passwordTranslateY = useRef(new Animated.Value(12)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonTranslateY = useRef(new Animated.Value(12)).current;
  const launchRedirectedRef = useRef(false);

  const animateTo = (destination: "/admin" | "/member" | "/setup") => {
    if (launchRedirectedRef.current) return;
    launchRedirectedRef.current = true;
    setIsTransitioning(true);
    Animated.parallel([
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(screenTranslateY, {
        toValue: -12,
        duration: 400,
        easing: Easing.out(Easing.inOut(Easing.cubic)),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) router.replace(destination);
    });
  };

  React.useEffect(() => {
    const entrance = Animated.stagger(65, [
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, damping: 15, stiffness: 180, mass: 0.8, overshootClamping: true, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(headerOpacity, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(headerTranslateY, { toValue: 0, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(cardOpacity, { toValue: 1, duration: 360, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(cardTranslateY, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(cardScale, { toValue: 1, damping: 18, stiffness: 190, mass: 0.8, overshootClamping: true, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(phoneOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.timing(phoneTranslateY, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(passwordOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.timing(passwordTranslateY, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(buttonOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.timing(buttonTranslateY, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]);
    entrance.start();
    return () => entrance.stop();
  }, [
    buttonOpacity, buttonTranslateY, cardOpacity, cardScale, cardTranslateY,
    headerOpacity, headerTranslateY, logoOpacity, logoScale, passwordOpacity,
    passwordTranslateY, phoneOpacity, phoneTranslateY,
  ]);

  React.useEffect(() => {
    if (isLoading || (!user && !needsSetup) || launchRedirectedRef.current) return;
    const timer = setTimeout(() => {
      animateTo(needsSetup ? "/setup" : user!.role === "admin" ? "/admin" : "/member");
    }, 400);
    return () => clearTimeout(timer);
  }, [isLoading, needsSetup, user]);

  const handleLogin = async () => {
    if (!phone.trim() || !password) {
      setError("Please fill in all fields");
      return;
    }
    setLoading(true);
    setError("");
    const result = await login(phone.trim(), password);
    setLoading(false);
    if (result) {
      router.replace(result.role === "admin" ? "/admin" : "/member");
    } else {
      setError("Invalid credentials. Please try again.");
    }
  };

  return (
    <Animated.View
      style={[
        styles.screen,
        { opacity: screenOpacity, transform: [{ translateY: screenTranslateY }] },
      ]}
    >
    <LinearGradient colors={BG_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.gradient}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
        <View style={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>

          {/* ── Logo + Branding ── */}
          <View style={styles.header}>
            <Animated.View
              style={[
                styles.logoGlowOuter,
                { opacity: logoOpacity, transform: [{ scale: logoScale }] },
              ]}
            >
              <View style={styles.logoGlowInner}>
                <LinearGradient
                  colors={[PRIMARY, PRIMARY2]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.logoCircle}
                >
                  <Feather name="coffee" size={34} color="#fff" />
                </LinearGradient>
              </View>
            </Animated.View>

            <Animated.View
              style={[
                styles.titleBlock,
                { opacity: headerOpacity, transform: [{ translateY: headerTranslateY }] },
              ]}
            >
              <Text style={styles.appName}>Dishari Mess</Text>
              <Text style={styles.appTagline}>Management System</Text>
              <View style={styles.taglinePill}>
                <Feather name="shield" size={11} color={PRIMARY} />
                <Text style={styles.taglinePillText}>Secure · Smart · Seamless</Text>
              </View>
            </Animated.View>
          </View>

          {/* ── Login Card ── */}
          <Animated.View
            style={[
              styles.card,
              {
                opacity: cardOpacity,
                transform: [{ translateY: cardTranslateY }, { scale: cardScale }],
              },
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderIcon}>
                <Feather name="log-in" size={18} color={PRIMARY} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>Welcome Back</Text>
                <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>Sign in to your account</Text>
              </View>
            </View>

            <View style={[styles.cardDivider, { backgroundColor: colors.border }]} />

            {/* Phone */}
            <Animated.View
              style={[
                styles.fieldGroup,
                { opacity: phoneOpacity, transform: [{ translateY: phoneTranslateY }] },
              ]}
            >
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Phone / User ID</Text>
              <View style={[
                styles.inputWrap,
                {
                  borderColor: phoneFocused ? PRIMARY : phone ? "#A5B4FC" : colors.input,
                  backgroundColor: phoneFocused ? "rgba(79,70,229,0.06)" : colors.muted,
                },
              ]}>
                <View style={[styles.inputIcon, { backgroundColor: phoneFocused ? "rgba(79,70,229,0.12)" : colors.border }]}>
                  <Feather name="phone" size={16} color={phoneFocused ? PRIMARY : colors.mutedForeground} />
                </View>
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder="Enter your phone or ID"
                  placeholderTextColor={colors.mutedForeground}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="default"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onFocus={() => setPhoneFocused(true)}
                  onBlur={() => setPhoneFocused(false)}
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
              </View>
            </Animated.View>

            {/* Password */}
            <Animated.View
              style={[
                styles.fieldGroup,
                { opacity: passwordOpacity, transform: [{ translateY: passwordTranslateY }] },
              ]}
            >
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Password</Text>
              <View style={[
                styles.inputWrap,
                {
                  borderColor: passFocused ? PRIMARY : password ? "#A5B4FC" : colors.input,
                  backgroundColor: passFocused ? "rgba(79,70,229,0.06)" : colors.muted,
                },
              ]}>
                <View style={[styles.inputIcon, { backgroundColor: passFocused ? "rgba(79,70,229,0.12)" : colors.border }]}>
                  <Feather name="lock" size={16} color={passFocused ? PRIMARY : colors.mutedForeground} />
                </View>
                <TextInput
                  ref={passwordRef}
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.mutedForeground}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="go"
                  onFocus={() => setPassFocused(true)}
                  onBlur={() => setPassFocused(false)}
                  onSubmitEditing={handleLogin}
                />
                <Pressable onPress={() => setShowPass(!showPass)} hitSlop={8} style={styles.eyeBtn}>
                  <Feather name={showPass ? "eye-off" : "eye"} size={16} color={passFocused ? PRIMARY : colors.mutedForeground} />
                </Pressable>
              </View>
            </Animated.View>

            {/* Error */}
            {error ? (
              <View style={styles.errorWrap}>
                <View style={styles.errorIconWrap}>
                  <Feather name="alert-circle" size={14} color="#F43F5E" />
                </View>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Button */}
            <Animated.View
              style={[
                styles.animatedButton,
                { opacity: buttonOpacity, transform: [{ translateY: buttonTranslateY }] },
              ]}
            >
              <Pressable
                onPress={handleLogin}
                disabled={loading || isTransitioning}
                style={({ pressed }) => [{ opacity: pressed || loading || isTransitioning ? 0.85 : 1 }]}
              >
                <LinearGradient
                  colors={[PRIMARY, PRIMARY2]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.loginBtn}
                >
                  {loading || isTransitioning ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator color="#fff" size="small" />
                      <Text style={styles.loginBtnText}>{isTransitioning ? "Opening…" : "Signing In…"}</Text>
                    </View>
                  ) : (
                    <View style={styles.loginBtnRow}>
                      <Text style={styles.loginBtnText}>Sign In</Text>
                      <Feather name="arrow-right" size={18} color="#fff" />
                    </View>
                  )}
                </LinearGradient>
              </Pressable>
            </Animated.View>
          </Animated.View>

          {/* ── Hint ── */}
          <View style={styles.hint}>
            <View style={styles.hintBox}>
              <Feather name="info" size={12} color={PRIMARY} />
              <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
                Admin: ID <Text style={{ fontWeight: "700", color: PRIMARY }}>admin</Text>
                {"  ·  "}Members: use phone number
              </Text>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  gradient: { flex: 1 },
  flex: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 24, justifyContent: "center" },

  header: { alignItems: "center", marginBottom: 32 },
  logoGlowOuter: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: "rgba(79,70,229,0.10)",
    alignItems: "center", justifyContent: "center", marginBottom: 24,
  },
  logoGlowInner: {
    width: 94, height: 94, borderRadius: 47,
    backgroundColor: "rgba(79,70,229,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45, shadowRadius: 16, elevation: 14,
  },
  titleBlock: { alignItems: "center", gap: 4 },
  appName: { fontSize: 30, fontWeight: "800", letterSpacing: -0.5, color: "#1E1B4B" },
  appTagline: { fontSize: 14, color: "#6B7280", fontWeight: "500", marginBottom: 8 },
  taglinePill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(255,255,255,0.85)", borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.6)",
  },
  taglinePillText: { fontSize: 11, color: "#4F46E5", fontWeight: "600" },

  card: {
    borderRadius: 24, padding: 24, gap: 16,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.65)",
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14, shadowRadius: 24, elevation: 12,
  },
  cardHeaderRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardHeaderIcon: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: "rgba(79,70,229,0.10)",
    alignItems: "center", justifyContent: "center",
  },
  cardTitle: { fontSize: 20, fontWeight: "800" },
  cardSub: { fontSize: 13, marginTop: 1 },
  cardDivider: { height: 1, marginVertical: -4 },

  fieldGroup: { gap: 6 },
  animatedButton: { width: "100%" },
  fieldLabel: { fontSize: 12, fontWeight: "600", letterSpacing: 0.4 },
  inputWrap: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1.5, borderRadius: 16, overflow: "hidden",
  },
  inputIcon: { width: 48, height: 52, alignItems: "center", justifyContent: "center" },
  input: { flex: 1, fontSize: 15, paddingVertical: 14, paddingRight: 14 },
  eyeBtn: { padding: 14 },

  errorWrap: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 12, padding: 12,
    backgroundColor: "rgba(244,63,94,0.08)", borderWidth: 1, borderColor: "rgba(244,63,94,0.25)",
  },
  errorIconWrap: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: "rgba(244,63,94,0.12)", alignItems: "center", justifyContent: "center",
  },
  errorText: { fontSize: 13, flex: 1, fontWeight: "500", color: "#F43F5E" },

  loginBtn: {
    borderRadius: 16, paddingVertical: 17,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  loginBtnRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  loginBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  hint: { marginTop: 20, alignItems: "center" },
  hintBox: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.6)",
  },
  hintText: { fontSize: 12, textAlign: "center" },
});
