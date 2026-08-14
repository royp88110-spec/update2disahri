import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, ViewStyle } from "react-native";

import { BG_GRADIENT } from "@/constants/colors";

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Full-screen pastel gradient background (#7DE7D8 → #B7F5E7 → #DDF5FF).
 * Wrap every screen root with this instead of a plain View + backgroundColor.
 */
export function GradientBackground({ children, style }: Props) {
  return (
    <LinearGradient
      colors={BG_GRADIENT}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[styles.fill, style]}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
