import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SystemUI from "expo-system-ui";
import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform, StatusBar } from "react-native";

import colors from "@/constants/colors";

export type AppTheme = "light" | "dark";

const THEME_STORAGE_KEY = "dishari-theme";

interface ThemeContextValue {
  theme: AppTheme;
  isDark: boolean;
  setTheme: (theme: AppTheme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>("light");

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((saved) => {
      if (saved === "dark" || saved === "light") setThemeState(saved);
    }).catch(() => {
      // Light remains the safe default when preference storage is unavailable.
    });
  }, []);

  useEffect(() => {
    void AsyncStorage.setItem(THEME_STORAGE_KEY, theme);
    if (Platform.OS !== "web") {
      StatusBar.setBarStyle(theme === "dark" ? "light-content" : "dark-content");
    }
    void SystemUI.setBackgroundColorAsync(
      theme === "dark" ? colors.dark.background : colors.light.background,
    );
  }, [theme]);

  const setTheme = (nextTheme: AppTheme) => setThemeState(nextTheme);

  return (
    <ThemeContext.Provider value={{ theme, isDark: theme === "dark", setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}