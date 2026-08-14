/**
 * Shows one compact daily menu summary for members.
 *
 * The day and menu signature are persisted locally. This prevents the same
 * notification from returning on every tab change or app restart, while a
 * changed menu gets shown again immediately.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";

import type { MenuToastData } from "@/components/MenuToast";
import { useAuth } from "@/context/AuthContext";
import { useData, type RoutineEntry } from "@/context/DataContext";

const STORAGE_KEY = "@dishari/daily-menu-notification";
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MEAL_ORDER: RoutineEntry["mealType"][] = ["tiffin", "lunch", "dinner"];

type SeenRecord = {
  dayKey: string;
  signature: string;
};

function getDayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatItems(entry: RoutineEntry | undefined): string {
  if (!entry || entry.items.length === 0) return "";
  return entry.items
    .map((item) => `${item.emoji ?? (item.isVeg ? "🥬" : "🍖")} ${item.name}`)
    .join(" · ");
}

function buildToast(routine: RoutineEntry[], now = new Date()): MenuToastData {
  const today = now.getDay();
  const todayEntries = routine.filter((entry) => entry.dayOfWeek === today);
  const byMeal = new Map(todayEntries.map((entry) => [entry.mealType, entry]));
  const meals = MEAL_ORDER.map((mealType) => {
    const entry = byMeal.get(mealType);
    return {
      label: mealType === "tiffin" ? "Breakfast" as const : mealType === "lunch" ? "Lunch" as const : "Dinner" as const,
      items: formatItems(entry),
    };
  });
  const signature = todayEntries
    .sort((a, b) => a.mealType.localeCompare(b.mealType))
    .map((entry) => `${entry.id}:${entry.updatedAt}:${JSON.stringify(entry.items)}`)
    .join("|");
  const unavailable = meals.every((meal) => meal.items.length === 0);

  return {
    id: `${getDayKey(now)}:${signature || "unavailable"}`,
    dayName: DAY_NAMES[today],
    meals,
    unavailable,
  };
}

export function useMenuNotifications() {
  const { menuRoutine, isLoaded } = useData();
  const { user } = useAuth();
  const [current, setCurrent] = useState<MenuToastData | null>(null);
  const routineRef = useRef(menuRoutine);
  const userRef = useRef(user);
  const loadedRef = useRef(isLoaded);
  const seenRef = useRef<SeenRecord | null>(null);
  const evaluationRef = useRef<Promise<void> | null>(null);

  routineRef.current = menuRoutine;
  userRef.current = user;
  loadedRef.current = isLoaded;

  const evaluate = useCallback(async () => {
    if (!loadedRef.current || userRef.current?.role !== "member") return;
    if (evaluationRef.current) return evaluationRef.current;

    const run = (async () => {
      const now = new Date();
      const dayKey = getDayKey(now);
      const toast = buildToast(routineRef.current, now);
      const signature = toast.id.slice(dayKey.length + 1);
      const stored = seenRef.current ?? await readSeenRecord();
      seenRef.current = stored;

      if (stored?.dayKey === dayKey && stored.signature === signature) return;

      const nextSeen = { dayKey, signature };
      seenRef.current = nextSeen;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextSeen));
      setCurrent(toast);
    })().finally(() => {
      evaluationRef.current = null;
    });

    evaluationRef.current = run;
    return run;
  }, []);

  useEffect(() => {
    if (!isLoaded || user?.role !== "member") return;
    void evaluate();
  }, [evaluate, isLoaded, menuRoutine, user]);

  useEffect(() => {
    if (user?.role === "member") return;
    seenRef.current = null;
    setCurrent(null);
  }, [user]);

  useEffect(() => {
    if (user?.role !== "member") return;
    const now = new Date();
    const nextDay = new Date(now);
    nextDay.setHours(24, 0, 0, 50);
    const timer = setTimeout(() => void evaluate(), nextDay.getTime() - now.getTime());
    return () => clearTimeout(timer);
  }, [evaluate, user]);

  const onDismiss = useCallback(() => {
    setCurrent(null);
  }, []);

  return { current, onDismiss };
}

async function readSeenRecord(): Promise<SeenRecord | null> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<SeenRecord>;
    if (typeof parsed.dayKey === "string" && typeof parsed.signature === "string") {
      return { dayKey: parsed.dayKey, signature: parsed.signature };
    }
  } catch {
    // A storage failure should not prevent today's menu from being shown.
  }
  return null;
}