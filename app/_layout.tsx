import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router, useSegments } from "expo-router";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { DataProvider } from "@/context/DataContext";
import { ToastProvider } from "@/context/ToastContext";

const queryClient = new QueryClient();

// ── Auth guard ─────────────────────────────────────────────────────────────
// Minimal: only boots signed-out users off protected routes.
// index.tsx manages all launch-flow routing (session → dashboard, no session → login).
function AuthGuard() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;
    const top = segments[0] as string | undefined;
    const onProtected = top === "admin" || top === "member";
    if (!user && onProtected) {
      // Kicked out (e.g. token expired, logout) — go back to the launch screen.
      router.replace("/");
    }
  }, [isLoading, user, segments]);

  return null;
}

function RootLayoutNav() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false, animation: "none" }}>
        <Stack.Screen name="index"  options={{ headerShown: false, animation: "none" }} />
        <Stack.Screen name="login"  options={{ headerShown: false, animation: "none" }} />
        <Stack.Screen name="setup"  options={{ headerShown: false }} />
        <Stack.Screen name="admin"  options={{ headerShown: false, animation: "fade" }} />
        <Stack.Screen name="member" options={{ headerShown: false, animation: "fade" }} />
      </Stack>
      <AuthGuard />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider style={{ backgroundColor: "#7DE7D8" }}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <DataProvider>
            <AuthProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <ToastProvider>
                    <RootLayoutNav />
                  </ToastProvider>
                </KeyboardProvider>
              </GestureHandlerRootView>
            </AuthProvider>
          </DataProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
