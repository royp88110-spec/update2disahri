import { Redirect } from "expo-router";
import React from "react";

export default function IndexScreen() {
  // Always enter through the animated login screen. LoginScreen then uses the
  // existing Supabase session state to decide whether to continue to a dashboard.
  return <Redirect href="/login" />;
}
