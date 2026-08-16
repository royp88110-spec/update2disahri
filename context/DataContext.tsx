import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import { isSupabaseConfigured } from "@/lib/supabase";
import { sendExpoPushNotifications } from "@/lib/notification";

export interface Announcement {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  type: "general" | "payment_reminder";
  targetMemberId: string | null;
  targetMonth: string | null;
}

export interface Member {
  id: string;
  name: string;
  phone: string;
  email?: string;
  joinDate: string;
  roomNumber?: string;
  status: "active" | "inactive";
  password: string;
  pushToken?: string | null;
}

export interface Meal {
  id: string;
  memberId: string;
  date: string;
  morning: boolean;
  night: boolean;
}

export interface Expense {
  id: string;
  type: "grocery" | "vegetable" | "fish" | "meat" | "gas" | "other";
  shopName?: string;
  date: string;
  items?: string;
  amount: number;
  notes?: string;
}

export interface Advance {
  id: string;
  memberId: string;
  amount: number;
  date: string;
  method: string;
  notes?: string;
}

export interface EggEntry {
  id: string;
  memberId: string;
  date: string;
  count: number;
}

export interface Fine {
  id: string;
  memberId: string;
  amount: number;
  date: string;
  reason: string;
  notes?: string;
}

export interface Settings {
  eggPrice: number;
  cookSalary: number;
}

export interface BillPayment {
  id: string;
  memberId: string;
  month: string;       // "YYYY-MM"
  paid: boolean;
  paidAt: string | null;
  amount: number;
}

export interface UpiSettings {
  upiId: string;
  accountHolderName: string;
  qrCodeBase64: string | null;
  paymentNote: string | null;
}

export interface PaymentSubmission {
  id: string;
  memberId: string;
  month: string;
  claimedAmount: number;
  screenshotBase64: string | null;
  utr: string | null;
  status: "pending" | "approved" | "rejected";
  approvedAmount: number | null;
  submittedAt: string;
  reviewedAt: string | null;
  adminNotes: string | null;
  paymentMethod: "upi" | "cash" | null;
}

export interface MonthlyBill {
  memberId: string;
  memberName: string;
  mealCount: number;
  perMealCost: number;
  mealBill: number;
  eggCount: number;
  eggBill: number;
  cookShare: number;
  fineTotal: number;
  grossBill: number;
  totalAdvance: number;
  dueAmount: number;
  creditBalance: number;
}

export interface MenuItem {
  name: string;
  emoji?: string;
  isVeg: boolean;
  notes?: string;
}

export interface RoutineEntry {
  id: string;
  dayOfWeek: number;   // 0=Sun … 6=Sat
  mealType: "lunch" | "dinner" | "tiffin";
  items: MenuItem[];
  isSpecial: boolean;
  specialLabel?: string;
  updatedAt: string;
}

interface DataContextType {
  members: Member[];
  meals: Meal[];
  expenses: Expense[];
  advances: Advance[];
  eggs: EggEntry[];
  fines: Fine[];
  settings: Settings;
  payments: BillPayment[];
  paymentsError: string | null;
  announcements: Announcement[];
  upiSettings: UpiSettings | null;
  paymentSubmissions: PaymentSubmission[];
  menuRoutine: RoutineEntry[];
  setRoutineEntry: (dayOfWeek: number, mealType: "lunch" | "dinner" | "tiffin", items: MenuItem[], isSpecial: boolean, specialLabel?: string) => Promise<void>;
  deleteRoutineEntry: (id: string) => Promise<void>;
  isLoaded: boolean;
  addMember: (m: Omit<Member, "id">) => Promise<void>;
  updateMember: (id: string, u: Partial<Member>) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
  setMeal: (memberId: string, date: string, morning: boolean, night: boolean) => Promise<void>;
  setMealsBatch: (entries: { memberId: string; date: string; morning: boolean; night: boolean }[]) => Promise<void>;
  addExpense: (e: Omit<Expense, "id">) => Promise<void>;
  updateExpense: (id: string, u: Partial<Expense>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  addAdvance: (a: Omit<Advance, "id">) => Promise<void>;
  deleteAdvance: (id: string) => Promise<void>;
  addFine: (f: Omit<Fine, "id">) => Promise<void>;
  updateFine: (id: string, u: Partial<Fine>) => Promise<void>;
  deleteFine: (id: string) => Promise<void>;
  setEggEntry: (memberId: string, date: string, count: number) => Promise<void>;
  updateSettings: (s: Partial<Settings>) => Promise<void>;
  addAnnouncement: (title: string, body: string, type?: "general" | "payment_reminder", targetMemberId?: string | null, targetMonth?: string | null) => Promise<void>;
  deleteAnnouncement: (id: string) => Promise<void>;
  sendPaymentReminders: (month: string) => Promise<number>;
  markPaid: (memberId: string, month: string, amount: number) => Promise<void>;
  markUnpaid: (memberId: string, month: string) => Promise<void>;
  recordPayment: (memberId: string, month: string, paymentAmount: number, dueAmount: number) => Promise<void>;
  saveUpiSettings: (s: Partial<UpiSettings>) => Promise<void>;
  submitUpiPayment: (memberId: string, month: string, claimedAmount: number, screenshotBase64?: string | null, utr?: string | null) => Promise<PaymentSubmission>;
  approvePaymentSubmission: (id: string, approvedAmount: number) => Promise<void>;
  rejectPaymentSubmission: (id: string, adminNotes?: string) => Promise<void>;
  recordCashPayment: (memberId: string, month: string, amount: number, note?: string) => Promise<void>;
  calculateMonthlyBill: (memberId: string, month: string) => MonthlyBill;
  calculateAllMonthlyBills: (month: string) => MonthlyBill[];
  getMonthTotals: (month: string) => { totalExpense: number; totalMeals: number; perMealCost: number };
  refresh: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const getApiBase = (): string => {
  if (Platform.OS === "web") return "";
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (apiUrl) return apiUrl.replace(/\/$/, "");
  const domain = process.env.EXPO_PUBLIC_DOMAIN ?? "";
  return domain ? `https://${domain}` : "";
};

const apiCall = async (method: string, path: string, body?: unknown): Promise<unknown> => {
  const { getSupabase } = await import("@/lib/supabase");
  const { data: { session } } = await getSupabase().auth.getSession();
  const token = session?.access_token;
  const url = `${getApiBase()}/api${path}`;
  console.log(`[apiCall] ${method} ${url}`);
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    console.error(`[apiCall] Network error for ${method} ${url}:`, networkErr);
    throw new Error("Cannot reach the server. Check your connection and try again.");
  }
  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  if (!res.ok) {
    if (isJson) {
      const json = await res.json() as { error?: string; message?: string };
      const msg = json.error ?? json.message ?? `HTTP ${res.status}`;
      console.error(`[apiCall] ${method} ${url} → ${res.status}:`, msg);
      throw new Error(msg);
    }
    const text = await res.text();
    console.error(`[apiCall] ${method} ${url} → ${res.status} (non-JSON):`, text.slice(0, 300));
    throw new Error(`Server returned an unexpected response (HTTP ${res.status}). Please try again.`);
  }
  if (!isJson) {
    const text = await res.text();
    console.error(`[apiCall] ${method} ${url} returned non-JSON content-type "${contentType}":`, text.slice(0, 300));
    throw new Error("Server returned an unexpected response format. Please try again.");
  }
  return res.json() as Promise<unknown>;
};

const sb = () => import("@/lib/supabase").then(({ getSupabase }) => getSupabase());

function checkError(result: { error: { message: string } | null }): void {
  if (result.error) throw new Error(result.error.message);
}

function getData<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error("No data returned from database.");
  return result.data;
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [eggs, setEggs] = useState<EggEntry[]>([]);
  const [settings, setSettings] = useState<Settings>({ eggPrice: 12, cookSalary: 250 });
  const [fines, setFines] = useState<Fine[]>([]);
  const [payments, setPayments] = useState<BillPayment[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [upiSettings, setUpiSettings] = useState<UpiSettings | null>(null);
  const [paymentSubmissions, setPaymentSubmissions] = useState<PaymentSubmission[]>([]);
  const [menuRoutine, setMenuRoutine] = useState<RoutineEntry[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const fetchMembers = useCallback(async () => {
    const client = await sb();
    const { data } = await client.from("members").select("*").order("name");
    if (data) {
      setMembers(
        (data as Record<string, unknown>[]).map((m) => ({
          id: m.id as string,
          name: m.name as string,
          phone: m.phone as string,
          email: (m.email as string | undefined) ?? undefined,
          joinDate: m.join_date as string,
          roomNumber: (m.room_number as string | undefined) ?? undefined,
          status: m.status as "active" | "inactive",
          password: "",
          pushToken: (m.push_token as string | null | undefined) ?? null,
        }))
      );
    }
  }, []);

  const fetchMeals = useCallback(async () => {
    const client = await sb();
    const { data } = await client.from("meals").select("*");
    if (data) {
      setMeals(
        (data as Record<string, unknown>[]).map((m) => ({
          id: m.id as string,
          memberId: m.member_id as string,
          date: m.date as string,
          morning: m.morning as boolean,
          night: m.night as boolean,
        }))
      );
    }
  }, []);

  const fetchExpenses = useCallback(async () => {
    const client = await sb();
    const { data } = await client.from("expenses").select("*").order("date", { ascending: false });
    if (data) {
      setExpenses(
        (data as Record<string, unknown>[]).map((e) => ({
          id: e.id as string,
          type: e.type as Expense["type"],
          shopName: (e.shop_name as string | undefined) ?? undefined,
          date: e.date as string,
          items: (e.items as string | undefined) ?? undefined,
          amount: Number(e.amount),
          notes: (e.notes as string | undefined) ?? undefined,
        }))
      );
    }
  }, []);

  const fetchAdvances = useCallback(async () => {
    const client = await sb();
    const { data } = await client.from("advances").select("*").order("date", { ascending: false });
    if (data) {
      setAdvances(
        (data as Record<string, unknown>[]).map((a) => ({
          id: a.id as string,
          memberId: a.member_id as string,
          amount: Number(a.amount),
          date: a.date as string,
          method: (a.method as string) || "Cash",
          notes: (a.notes as string | undefined) ?? undefined,
        }))
      );
    }
  }, []);

  const fetchEggs = useCallback(async () => {
    const client = await sb();
    const { data } = await client.from("eggs").select("*");
    if (data) {
      setEggs(
        (data as Record<string, unknown>[]).map((e) => ({
          id: e.id as string,
          memberId: e.member_id as string,
          date: e.date as string,
          count: e.count as number,
        }))
      );
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    const client = await sb();
    const { data } = await client.from("settings").select("*").eq("id", 1).single();
    if (data) {
      setSettings({
        eggPrice: Number((data as Record<string, unknown>).egg_price),
        cookSalary: Number((data as Record<string, unknown>).cook_salary),
      });
    }
  }, []);

  const fetchPayments = useCallback(async () => {
    const client = await sb();
    const { data, error } = await client.from("bill_payments").select("*");
    if (error) {
      setPaymentsError(error.message);
      setPayments([]);
      return;
    }
    setPaymentsError(null);
    if (data) {
      setPayments(
        (data as Record<string, unknown>[]).map((p) => ({
          id: p.id as string,
          memberId: p.member_id as string,
          month: p.month as string,
          paid: p.paid as boolean,
          paidAt: (p.paid_at as string | null) ?? null,
          amount: p.amount != null ? Number(p.amount) : 0,
        }))
      );
    }
  }, []);

  const fetchFines = useCallback(async () => {
    const client = await sb();
    const { data } = await client.from("fines").select("*").order("date", { ascending: false });
    if (data) {
      setFines(
        (data as Record<string, unknown>[]).map((f) => ({
          id: f.id as string,
          memberId: f.member_id as string,
          amount: Number(f.amount),
          date: f.date as string,
          reason: (f.reason as string) || "",
          notes: (f.notes as string | undefined) ?? undefined,
        }))
      );
    }
  }, []);

  const fetchAnnouncements = useCallback(async () => {
    const client = await sb();
    const { data } = await client.from("announcements").select("*").order("created_at", { ascending: false });
    if (data) {
      setAnnouncements(
        (data as Record<string, unknown>[]).map((a) => ({
          id: a.id as string,
          title: a.title as string,
          body: a.body as string,
          createdAt: a.created_at as string,
          type: ((a.type as string) === "payment_reminder" ? "payment_reminder" : "general") as "general" | "payment_reminder",
          targetMemberId: (a.target_member_id as string | null) ?? null,
          targetMonth: (a.target_month as string | null) ?? null,
        }))
      );
    }
  }, []);

  const fetchUpiSettings = useCallback(async () => {
    const client = await sb();
    const { data } = await client.from("upi_settings").select("*").eq("id", 1).maybeSingle();
    if (data) {
      const r = data as Record<string, unknown>;
      setUpiSettings({
        upiId: (r.upi_id as string) || "",
        accountHolderName: (r.account_holder_name as string) || "",
        qrCodeBase64: (r.qr_code_base64 as string | null) ?? null,
        paymentNote: (r.payment_note as string | null) ?? null,
      });
    }
  }, []);

  const fetchPaymentSubmissions = useCallback(async () => {
    const client = await sb();
    const { data } = await client
      .from("payment_submissions")
      .select("*")
      .order("submitted_at", { ascending: false });
    if (data) {
      setPaymentSubmissions(
        (data as Record<string, unknown>[]).map((p) => ({
          id: p.id as string,
          memberId: p.member_id as string,
          month: p.month as string,
          claimedAmount: Number(p.claimed_amount),
          screenshotBase64: (p.screenshot_base64 as string | null) ?? null,
          utr: (p.utr as string | null) ?? null,
          status: p.status as "pending" | "approved" | "rejected",
          approvedAmount: p.approved_amount != null ? Number(p.approved_amount) : null,
          submittedAt: p.submitted_at as string,
          reviewedAt: (p.reviewed_at as string | null) ?? null,
          adminNotes: (p.admin_notes as string | null) ?? null,
          paymentMethod: (p.payment_method as "upi" | "cash" | null) ?? null,
        }))
      );
    }
  }, []);

  const fetchMenuRoutine = useCallback(async () => {
    const client = await sb();
    const { data } = await client.from("menu_routine").select("*").order("day_of_week").order("meal_type");
    if (data) {
      setMenuRoutine(
        (data as Record<string, unknown>[]).map((m) => ({
          id: m.id as string,
          dayOfWeek: m.day_of_week as number,
          mealType: m.meal_type as "lunch" | "dinner" | "tiffin",
          items: (m.items as MenuItem[]) ?? [],
          isSpecial: Boolean(m.is_special),
          specialLabel: (m.special_label as string | undefined) ?? undefined,
          updatedAt: m.updated_at as string,
        }))
      );
    }
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([
      fetchMembers(),
      fetchMeals(),
      fetchExpenses(),
      fetchAdvances(),
      fetchEggs(),
      fetchSettings(),
      fetchPayments(),
      fetchFines(),
      fetchAnnouncements(),
      fetchUpiSettings().catch(() => {}),
      fetchPaymentSubmissions().catch(() => {}),
      fetchMenuRoutine().catch(() => {}),
    ]);
    setIsLoaded(true);
  }, [fetchMembers, fetchMeals, fetchExpenses, fetchAdvances, fetchEggs, fetchSettings, fetchPayments, fetchFines, fetchAnnouncements, fetchUpiSettings, fetchPaymentSubmissions, fetchMenuRoutine]);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setIsLoaded(true);
      return;
    }

    let unsubscribe: (() => void) | null = null;

    sb().then((client) => {
      const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
        if (session) {
          loadAll().catch((err: Error) => console.error("[DataContext] loadAll failed:", err.message));
        } else {
          setMembers([]); setMeals([]); setExpenses([]);
          setAdvances([]); setEggs([]); setPayments([]);
          setFines([]); setAnnouncements([]);
          setSettings({ eggPrice: 12, cookSalary: 250 });
          setUpiSettings(null);
          setPaymentSubmissions([]);
          setMenuRoutine([]);
          setIsLoaded(false);
        }
      });
      unsubscribe = () => subscription.unsubscribe();

      client.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          loadAll().catch((err: Error) => {
            console.error("[DataContext] initial loadAll failed:", err.message);
            setIsLoaded(true);
          });
        } else {
          setIsLoaded(true);
        }
      }).catch((err: Error) => {
        console.error("[DataContext] getSession failed:", err.message);
        setIsLoaded(true);
      });
    }).catch((err: Error) => {
      console.error("[DataContext] Supabase client init failed:", err.message);
      setIsLoaded(true);
    });

    return () => { unsubscribe?.(); };
  }, [loadAll]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    let channel: ReturnType<Awaited<ReturnType<typeof sb>>["channel"]> | null = null;

    const safeAsync = (fn: () => Promise<void>, label: string) => () => {
      fn().catch((err: Error) => console.error(`[DataContext] ${label} failed:`, err.message));
    };

    sb().then((client) => {
      channel = client
        .channel("dishari-realtime")
        .on("postgres_changes", { event: "*", schema: "public", table: "members" }, safeAsync(fetchMembers, "fetchMembers"))
        .on("postgres_changes", { event: "*", schema: "public", table: "meals" }, safeAsync(fetchMeals, "fetchMeals"))
        .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, safeAsync(fetchExpenses, "fetchExpenses"))
        .on("postgres_changes", { event: "*", schema: "public", table: "advances" }, safeAsync(fetchAdvances, "fetchAdvances"))
        .on("postgres_changes", { event: "*", schema: "public", table: "eggs" }, safeAsync(fetchEggs, "fetchEggs"))
        .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, safeAsync(fetchSettings, "fetchSettings"))
        .on("postgres_changes", { event: "*", schema: "public", table: "bill_payments" }, safeAsync(fetchPayments, "fetchPayments"))
        .on("postgres_changes", { event: "*", schema: "public", table: "fines" }, safeAsync(fetchFines, "fetchFines"))
        .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, safeAsync(fetchAnnouncements, "fetchAnnouncements"))
        .on("postgres_changes", { event: "*", schema: "public", table: "upi_settings" }, safeAsync(fetchUpiSettings, "fetchUpiSettings"))
        .on("postgres_changes", { event: "*", schema: "public", table: "payment_submissions" }, safeAsync(fetchPaymentSubmissions, "fetchPaymentSubmissions"))
        .on("postgres_changes", { event: "*", schema: "public", table: "menu_routine" }, safeAsync(fetchMenuRoutine, "fetchMenuRoutine"))
        .subscribe();
    }).catch((err: Error) => {
      console.error("[DataContext] realtime channel setup failed:", err.message);
    });

    return () => {
      sb().then((client) => {
        if (channel) client.removeChannel(channel!).catch((err: Error) => {
          console.error("[DataContext] removeChannel failed:", err.message);
        });
      }).catch((err: Error) => {
        console.error("[DataContext] cleanup sb() failed:", err.message);
      });
    };
  }, [fetchMembers, fetchMeals, fetchExpenses, fetchAdvances, fetchEggs, fetchSettings, fetchPayments, fetchFines, fetchAnnouncements, fetchUpiSettings, fetchPaymentSubmissions, fetchMenuRoutine]);

  // ── Members ──────────────────────────────────────────────────────────────
  const addMember = async (m: Omit<Member, "id">) => {
    const res = await apiCall("POST", "/admin/members", {
      name: m.name, phone: m.phone, email: m.email,
      roomNumber: m.roomNumber, joinDate: m.joinDate,
      status: m.status, password: m.password,
    }) as { success: boolean; member: Record<string, unknown> };
    const r = res.member;
    const newMember: Member = {
      id: r.id as string,
      name: r.name as string,
      phone: r.phone as string,
      email: (r.email as string | undefined) ?? undefined,
      joinDate: r.join_date as string,
      roomNumber: (r.room_number as string | undefined) ?? undefined,
      status: r.status as "active" | "inactive",
      password: "",
    };
    setMembers((prev) =>
      [...prev, newMember].sort((a, b) => a.name.localeCompare(b.name))
    );
  };

  const updateMember = async (id: string, u: Partial<Member>) => {
    const prevMember = members.find((m) => m.id === id);
    setMembers((ms) => ms.map((m) => (m.id === id ? { ...m, ...u } : m)));
    try {
      const { password, ...rest } = u;
      if (password !== undefined && password.trim()) {
        await apiCall("PATCH", `/admin/members/${id}/password`, { password });
      }
      const profileUpdate: Record<string, unknown> = {};
      if (rest.name !== undefined) profileUpdate.name = rest.name;
      if (rest.phone !== undefined) profileUpdate.phone = rest.phone;
      if (rest.email !== undefined) profileUpdate.email = rest.email;
      if (rest.roomNumber !== undefined) profileUpdate.roomNumber = rest.roomNumber;
      if (rest.joinDate !== undefined) profileUpdate.joinDate = rest.joinDate;
      if (rest.status !== undefined) profileUpdate.status = rest.status;
      if (Object.keys(profileUpdate).length > 0) {
        await apiCall("PATCH", `/admin/members/${id}`, profileUpdate);
      }
    } catch (err) {
      if (prevMember) setMembers((ms) => ms.map((m) => (m.id === id ? prevMember : m)));
      throw err;
    }
  };

  const deleteMember = async (id: string) => {
    const prevMember = members.find((m) => m.id === id);
    setMembers((ms) => ms.filter((m) => m.id !== id));
    try {
      await apiCall("DELETE", `/admin/members/${id}`);
    } catch (err) {
      if (prevMember) {
        setMembers((ms) =>
          ms.some((m) => m.id === id)
            ? ms
            : [...ms, prevMember].sort((a, b) => a.name.localeCompare(b.name))
        );
      }
      throw err;
    }
  };

  // ── Meals ─────────────────────────────────────────────────────────────────
  const setMeal = async (memberId: string, date: string, morning: boolean, night: boolean) => {
    const prevMeal = meals.find((m) => m.memberId === memberId && m.date === date);
    setMeals((ms) => {
      const idx = ms.findIndex((m) => m.memberId === memberId && m.date === date);
      if (idx >= 0) {
        const next = [...ms];
        next[idx] = { ...next[idx], morning, night };
        return next;
      }
      return [...ms, { id: `opt-${memberId}-${date}`, memberId, date, morning, night }];
    });
    try {
      const client = await sb();
      const { data: existing, error: fetchErr } = await client
        .from("meals")
        .select("id")
        .eq("member_id", memberId)
        .eq("date", date)
        .maybeSingle();
      if (fetchErr) throw new Error(fetchErr.message);
      if (existing) {
        checkError(await client.from("meals").update({ morning, night }).eq("id", existing.id));
      } else {
        checkError(await client.from("meals").insert({ member_id: memberId, date, morning, night }));
      }
    } catch (err) {
      setMeals((ms) => {
        const without = ms.filter((m) => !(m.memberId === memberId && m.date === date));
        return prevMeal ? [...without, prevMeal] : without;
      });
      throw err;
    }
  };

  const setMealsBatch = async (entries: { memberId: string; date: string; morning: boolean; night: boolean }[]) => {
    if (entries.length === 0) return;
    const affectedKeys = new Set(entries.map((e) => `${e.memberId}|${e.date}`));
    const prevSlots = meals.filter((m) => affectedKeys.has(`${m.memberId}|${m.date}`));
    setMeals((ms) => {
      const next = [...ms];
      for (const e of entries) {
        const idx = next.findIndex((m) => m.memberId === e.memberId && m.date === e.date);
        if (idx >= 0) {
          next[idx] = { ...next[idx], morning: e.morning, night: e.night };
        } else {
          next.push({ id: `opt-${e.memberId}-${e.date}`, memberId: e.memberId, date: e.date, morning: e.morning, night: e.night });
        }
      }
      return next;
    });
    try {
      const client = await sb();
      const uniqueDates = [...new Set(entries.map((e) => e.date))];
      const memberIds = [...new Set(entries.map((e) => e.memberId))];
      const { data: existingRows, error: fetchErr } = await client
        .from("meals")
        .select("id, member_id, date")
        .in("date", uniqueDates)
        .in("member_id", memberIds);
      if (fetchErr) throw new Error(fetchErr.message);
      const existingMap = new Map(
        (existingRows ?? []).map((r) => [`${r.member_id as string}|${r.date as string}`, r.id as string])
      );
      const toInsert = entries.filter((e) => !existingMap.has(`${e.memberId}|${e.date}`));
      const toUpdate = entries.filter((e) => existingMap.has(`${e.memberId}|${e.date}`));
      if (toInsert.length > 0) {
        checkError(
          await client.from("meals").insert(
            toInsert.map((e) => ({ member_id: e.memberId, date: e.date, morning: e.morning, night: e.night }))
          )
        );
      }
      if (toUpdate.length > 0) {
        const results = await Promise.all(
          toUpdate.map((e) => {
            const id = existingMap.get(`${e.memberId}|${e.date}`)!;
            return client.from("meals").update({ morning: e.morning, night: e.night }).eq("id", id);
          })
        );
        for (const res of results) checkError(res);
      }
    } catch (err) {
      setMeals((ms) => {
        const withoutAffected = ms.filter((m) => !affectedKeys.has(`${m.memberId}|${m.date}`));
        return [...withoutAffected, ...prevSlots];
      });
      throw err;
    }
  };

  // ── Expenses ──────────────────────────────────────────────────────────────
  const addExpense = async (e: Omit<Expense, "id">) => {
    const client = await sb();
    const r = getData(
      await client.from("expenses").insert({
        type: e.type, shop_name: e.shopName ?? null, date: e.date,
        items: e.items ?? null, amount: e.amount, notes: e.notes ?? null,
      }).select().single()
    ) as Record<string, unknown>;
    setExpenses((prev) => [
      {
        id: r.id as string,
        type: r.type as Expense["type"],
        shopName: (r.shop_name as string | undefined) ?? undefined,
        date: r.date as string,
        items: (r.items as string | undefined) ?? undefined,
        amount: Number(r.amount),
        notes: (r.notes as string | undefined) ?? undefined,
      },
      ...prev,
    ]);
  };

  const updateExpense = async (id: string, u: Partial<Expense>) => {
    const prevExpense = expenses.find((e) => e.id === id);
    setExpenses((es) => es.map((e) => (e.id === id ? { ...e, ...u } : e)));
    try {
      const row: Record<string, unknown> = {};
      if (u.type !== undefined) row.type = u.type;
      if (u.shopName !== undefined) row.shop_name = u.shopName;
      if (u.date !== undefined) row.date = u.date;
      if (u.items !== undefined) row.items = u.items;
      if (u.amount !== undefined) row.amount = u.amount;
      if (u.notes !== undefined) row.notes = u.notes;
      const client = await sb();
      checkError(await client.from("expenses").update(row).eq("id", id));
    } catch (err) {
      if (prevExpense) setExpenses((es) => es.map((e) => (e.id === id ? prevExpense : e)));
      throw err;
    }
  };

  const deleteExpense = async (id: string) => {
    const prevExpense = expenses.find((e) => e.id === id);
    setExpenses((es) => es.filter((e) => e.id !== id));
    try {
      const client = await sb();
      checkError(await client.from("expenses").delete().eq("id", id));
    } catch (err) {
      if (prevExpense) {
        setExpenses((es) =>
          es.some((e) => e.id === id) ? es : [prevExpense, ...es]
        );
      }
      throw err;
    }
  };

  // ── Advances ──────────────────────────────────────────────────────────────
  const addAdvance = async (a: Omit<Advance, "id">) => {
    const client = await sb();
    const r = getData(
      await client.from("advances").insert({
        member_id: a.memberId, amount: a.amount, date: a.date,
        method: a.method, notes: a.notes ?? null,
      }).select().single()
    ) as Record<string, unknown>;
    setAdvances((prev) => [
      {
        id: r.id as string,
        memberId: r.member_id as string,
        amount: Number(r.amount),
        date: r.date as string,
        method: (r.method as string) || "Cash",
        notes: (r.notes as string | undefined) ?? undefined,
      },
      ...prev,
    ]);
  };

  const deleteAdvance = async (id: string) => {
    const prevAdvance = advances.find((a) => a.id === id);
    setAdvances((as) => as.filter((a) => a.id !== id));
    try {
      const client = await sb();
      checkError(await client.from("advances").delete().eq("id", id));
    } catch (err) {
      if (prevAdvance) {
        setAdvances((as) =>
          as.some((a) => a.id === id) ? as : [prevAdvance, ...as]
        );
      }
      throw err;
    }
  };

  // ── Eggs ──────────────────────────────────────────────────────────────────
  const setEggEntry = async (memberId: string, date: string, count: number) => {
    const prevEgg = eggs.find((e) => e.memberId === memberId && e.date === date);
    setEggs((es) => {
      const without = es.filter((e) => !(e.memberId === memberId && e.date === date));
      if (count === 0) return without;
      return [...without, { id: prevEgg?.id ?? `opt-${memberId}-${date}`, memberId, date, count }];
    });
    try {
      const client = await sb();
      if (count === 0) {
        checkError(await client.from("eggs").delete().match({ member_id: memberId, date }));
      } else {
        checkError(
          await client.from("eggs").upsert(
            { member_id: memberId, date, count },
            { onConflict: "member_id,date" }
          )
        );
      }
    } catch (err) {
      setEggs((es) => {
        const without = es.filter((e) => !(e.memberId === memberId && e.date === date));
        return prevEgg ? [...without, prevEgg] : without;
      });
      throw err;
    }
  };

  // ── Settings ──────────────────────────────────────────────────────────────
  const updateSettings = async (s: Partial<Settings>) => {
    const prev = settings;
    const next = { ...settings, ...s };
    setSettings(next);
    try {
      const client = await sb();
      checkError(
        await client.from("settings").upsert(
          { id: 1, egg_price: next.eggPrice, cook_salary: next.cookSalary },
          { onConflict: "id" }
        )
      );
    } catch (err) {
      setSettings(prev);
      throw err;
    }
  };

  // ── Bill payments ─────────────────────────────────────────────────────────
  const buildPaymentRow = (memberId: string, month: string, extra: Record<string, unknown>) => {
    const year = Number(month.split("-")[0]);
    return { member_id: memberId, month, year, ...extra };
  };

  const markPaid = async (memberId: string, month: string, amount: number) => {
    const prevPayment = payments.find((p) => p.memberId === memberId && p.month === month);
    const now = new Date().toISOString();
    setPayments((ps) => {
      const without = ps.filter((p) => !(p.memberId === memberId && p.month === month));
      return [...without, { id: prevPayment?.id ?? "optimistic", memberId, month, paid: true, paidAt: now, amount }];
    });
    try {
      const client = await sb();
      const existingId = prevPayment && prevPayment.id !== "optimistic" ? prevPayment.id : null;
      if (existingId) {
        checkError(
          await client.from("bill_payments")
            .update({ paid: true, paid_at: now })
            .eq("id", existingId)
        );
      } else {
        const { data: dbRow, error: selectErr } = await client
          .from("bill_payments")
          .select("id")
          .eq("member_id", memberId)
          .eq("month", month)
          .maybeSingle();
        if (selectErr) throw new Error(selectErr.message);
        if (dbRow?.id) {
          checkError(
            await client.from("bill_payments")
              .update({ paid: true, paid_at: now })
              .eq("id", dbRow.id)
          );
        } else {
          checkError(
            await client.from("bill_payments")
              .insert(buildPaymentRow(memberId, month, { paid: true, paid_at: now }))
          );
        }
      }
    } catch (err) {
      setPayments((ps) => {
        const without = ps.filter((p) => !(p.memberId === memberId && p.month === month));
        return prevPayment ? [...without, prevPayment] : without;
      });
      throw err;
    }
  };

  const markUnpaid = async (memberId: string, month: string) => {
    const prevPayment = payments.find((p) => p.memberId === memberId && p.month === month);
    setPayments((ps) => {
      const without = ps.filter((p) => !(p.memberId === memberId && p.month === month));
      return [...without, { id: prevPayment?.id ?? "optimistic", memberId, month, paid: false, paidAt: null, amount: 0 }];
    });
    try {
      const client = await sb();
      const existingId = prevPayment && prevPayment.id !== "optimistic" ? prevPayment.id : null;
      if (existingId) {
        checkError(
          await client.from("bill_payments")
            .update({ paid: false, paid_at: null, amount: 0 })
            .eq("id", existingId)
        );
      } else {
        const { data: dbRow, error: selectErr } = await client
          .from("bill_payments")
          .select("id")
          .eq("member_id", memberId)
          .eq("month", month)
          .maybeSingle();
        if (selectErr) throw new Error(selectErr.message);
        if (dbRow?.id) {
          checkError(
            await client.from("bill_payments")
              .update({ paid: false, paid_at: null, amount: 0 })
              .eq("id", dbRow.id)
          );
        } else {
          checkError(
            await client.from("bill_payments")
              .insert(buildPaymentRow(memberId, month, { paid: false, paid_at: null, amount: 0 }))
          );
        }
      }
    } catch (err) {
      setPayments((ps) => {
        const without = ps.filter((p) => !(p.memberId === memberId && p.month === month));
        return prevPayment ? [...without, prevPayment] : without;
      });
      throw err;
    }
  };

  const recordPayment = async (memberId: string, month: string, paymentAmount: number, dueAmount: number) => {
    const prevPayment = payments.find((p) => p.memberId === memberId && p.month === month);
    const existingAmount = prevPayment?.amount ?? 0;
    const newTotal = existingAmount + paymentAmount;
    const isFullyPaid = newTotal >= dueAmount;
    const now = new Date().toISOString();
    const paidAt = isFullyPaid ? now : (prevPayment?.paidAt ?? null);

    setPayments((ps) => {
      const without = ps.filter((p) => !(p.memberId === memberId && p.month === month));
      return [...without, { id: prevPayment?.id ?? "optimistic", memberId, month, paid: isFullyPaid, paidAt, amount: newTotal }];
    });

    try {
      const client = await sb();
      const existingId = prevPayment && prevPayment.id !== "optimistic" ? prevPayment.id : null;
      if (existingId) {
        checkError(
          await client.from("bill_payments")
            .update({ paid: isFullyPaid, paid_at: paidAt, amount: newTotal })
            .eq("id", existingId)
        );
      } else {
        const { data: dbRow, error: selectErr } = await client
          .from("bill_payments")
          .select("id")
          .eq("member_id", memberId)
          .eq("month", month)
          .maybeSingle();
        if (selectErr) throw new Error(selectErr.message);
        if (dbRow?.id) {
          checkError(
            await client.from("bill_payments")
              .update({ paid: isFullyPaid, paid_at: paidAt, amount: newTotal })
              .eq("id", dbRow.id)
          );
        } else {
          checkError(
            await client.from("bill_payments")
              .insert(buildPaymentRow(memberId, month, { paid: isFullyPaid, paid_at: paidAt, amount: newTotal }))
          );
        }
      }
    } catch (err) {
      setPayments((ps) => {
        const without = ps.filter((p) => !(p.memberId === memberId && p.month === month));
        return prevPayment ? [...without, prevPayment] : without;
      });
      throw err;
    }
  };

  // ── Fines ─────────────────────────────────────────────────────────────────
  const isNotesColumnMissing = (e: { message?: string } | null) =>
    !!(e?.message?.includes("notes") && (e.message.includes("schema cache") || e.message.includes("does not exist")));

  const addFine = async (f: Omit<Fine, "id">) => {
    const client = await sb();
    let result = await client.from("fines").insert({
      member_id: f.memberId, amount: f.amount, date: f.date, reason: f.reason,
      ...(f.notes ? { notes: f.notes } : {}),
    }).select().single();
    if (isNotesColumnMissing(result.error)) {
      result = await client.from("fines").insert({
        member_id: f.memberId, amount: f.amount, date: f.date, reason: f.reason,
      }).select().single();
    }
    const r = getData(result) as Record<string, unknown>;
    setFines((prev) => [
      {
        id: r.id as string,
        memberId: r.member_id as string,
        amount: Number(r.amount),
        date: r.date as string,
        reason: (r.reason as string) || "",
        notes: (r.notes as string | undefined) ?? undefined,
      },
      ...prev,
    ]);
  };

  const updateFine = async (id: string, u: Partial<Fine>) => {
    const prevFine = fines.find((f) => f.id === id);
    setFines((fs) => fs.map((f) => (f.id === id ? { ...f, ...u } : f)));
    try {
      const row: Record<string, unknown> = {};
      if (u.memberId !== undefined) row.member_id = u.memberId;
      if (u.amount !== undefined) row.amount = u.amount;
      if (u.date !== undefined) row.date = u.date;
      if (u.reason !== undefined) row.reason = u.reason;
      if ("notes" in u) row.notes = (u.notes && u.notes.trim()) ? u.notes.trim() : null;
      const client = await sb();
      let updateResult = await client.from("fines").update(row).eq("id", id);
      if (isNotesColumnMissing(updateResult.error)) {
        const { notes: _dropped, ...rowWithoutNotes } = row;
        updateResult = await client.from("fines").update(rowWithoutNotes).eq("id", id);
      }
      checkError(updateResult);
    } catch (err) {
      if (prevFine) setFines((fs) => fs.map((f) => (f.id === id ? prevFine : f)));
      throw err;
    }
  };

  const deleteFine = async (id: string) => {
    const prevFine = fines.find((f) => f.id === id);
    setFines((fs) => fs.filter((f) => f.id !== id));
    try {
      const client = await sb();
      checkError(await client.from("fines").delete().eq("id", id));
    } catch (err) {
      if (prevFine) {
        setFines((fs) =>
          fs.some((f) => f.id === id) ? fs : [prevFine, ...fs]
        );
      }
      throw err;
    }
  };

  // ── Announcements ─────────────────────────────────────────────────────────
  const addAnnouncement = async (
    title: string,
    body: string,
    type: "general" | "payment_reminder" = "general",
    targetMemberId: string | null = null,
    targetMonth: string | null = null,
  ) => {
    const client = await sb();
    const row = getData(
      await client.from("announcements").insert({
        title, body, type,
        target_member_id: targetMemberId,
        target_month: targetMonth,
      }).select().single()
    ) as Record<string, unknown>;
    setAnnouncements((prev) => [{
      id: row.id as string,
      title: row.title as string,
      body: row.body as string,
      createdAt: row.created_at as string,
      type: ((row.type as string) === "payment_reminder" ? "payment_reminder" : "general") as "general" | "payment_reminder",
      targetMemberId: (row.target_member_id as string | null) ?? null,
      targetMonth: (row.target_month as string | null) ?? null,
    }, ...prev]);

    const recipients = members.filter(
      (member) =>
        member.status === "active" &&
        (!targetMemberId || member.id === targetMemberId) &&
        member.pushToken,
    );
    if (recipients.length > 0) {
      try {
        await sendExpoPushNotifications(
          recipients.map((member) => ({
            to: member.pushToken!,
            title,
            body,
            sound: "default",
            data: {
              type,
              announcementId: row.id,
              route: type === "payment_reminder" ? "/member/payments" : "/member/notices",
            },
          })),
        );
      } catch (error) {
        console.error("[PushNotifications] Announcement saved but push send failed", error);
      }
    }
  };

  const deleteAnnouncement = async (id: string) => {
    const prev = announcements.find((a) => a.id === id);
    setAnnouncements((as) => as.filter((a) => a.id !== id));
    try {
      const client = await sb();
      checkError(await client.from("announcements").delete().eq("id", id));
    } catch (err) {
      if (prev) setAnnouncements((as) => [prev, ...as]);
      throw err;
    }
  };

  // ── UPI Settings ──────────────────────────────────────────────────────────
  const saveUpiSettings = async (s: Partial<UpiSettings>) => {
    const prev = upiSettings;
    const next: UpiSettings = {
      upiId: "",
      accountHolderName: "",
      qrCodeBase64: null,
      paymentNote: null,
      ...(upiSettings ?? {}),
      ...s,
    };
    setUpiSettings(next);
    try {
      const client = await sb();
      checkError(
        await client.from("upi_settings").upsert(
          {
            id: 1,
            upi_id: next.upiId,
            account_holder_name: next.accountHolderName,
            qr_code_base64: next.qrCodeBase64,
            payment_note: next.paymentNote,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        )
      );
    } catch (err) {
      setUpiSettings(prev);
      throw err;
    }
  };

  // ── Payment Submissions ───────────────────────────────────────────────────
  const submitUpiPayment = async (
    memberId: string,
    month: string,
    claimedAmount: number,
    screenshotBase64?: string | null,
    utr?: string | null,
  ): Promise<PaymentSubmission> => {
    const client = await sb();
    const r = getData(
      await client.from("payment_submissions").insert({
        member_id: memberId,
        month,
        claimed_amount: claimedAmount,
        screenshot_base64: screenshotBase64 ?? null,
        utr: utr ?? null,
        status: "pending",
      }).select().single()
    ) as Record<string, unknown>;
    const submission: PaymentSubmission = {
      id: r.id as string,
      memberId: r.member_id as string,
      month: r.month as string,
      claimedAmount: Number(r.claimed_amount),
      screenshotBase64: (r.screenshot_base64 as string | null) ?? null,
      utr: (r.utr as string | null) ?? null,
      status: "pending",
      approvedAmount: null,
      submittedAt: r.submitted_at as string,
      reviewedAt: null,
      adminNotes: null,
      paymentMethod: null,
    };
    setPaymentSubmissions((prev) => [submission, ...prev]);
    return submission;
  };

  const approvePaymentSubmission = async (id: string, approvedAmount: number) => {
    const sub = paymentSubmissions.find((p) => p.id === id);
    if (!sub) throw new Error("Submission not found");
    const now = new Date().toISOString();

    setPaymentSubmissions((ps) =>
      ps.map((p) => p.id === id ? { ...p, status: "approved" as const, approvedAmount, reviewedAt: now } : p)
    );

    try {
      const bill = calculateMonthlyBill(sub.memberId, sub.month);

      // Try API server first (atomic: updates both submission + bill_payments with service key)
      let viaApi = false;
      try {
        await apiCall("POST", `/admin/payments/${id}/approve`, {
          approvedAmount,
          dueAmount: bill.dueAmount,
        });
        viaApi = true;
      } catch {
        // API server unavailable — fall back to direct Supabase
      }

      if (!viaApi) {
        const client = await sb();
        checkError(
          await client.from("payment_submissions").update({
            status: "approved",
            approved_amount: approvedAmount,
            reviewed_at: now,
          }).eq("id", id)
        );
        await recordPayment(sub.memberId, sub.month, approvedAmount, bill.dueAmount);
      }
    } catch (err) {
      if (sub) {
        setPaymentSubmissions((ps) => ps.map((p) => p.id === id ? sub : p));
      }
      throw err;
    }
  };

  const rejectPaymentSubmission = async (id: string, adminNotes?: string) => {
    const sub = paymentSubmissions.find((p) => p.id === id);
    const now = new Date().toISOString();

    setPaymentSubmissions((ps) =>
      ps.map((p) =>
        p.id === id ? { ...p, status: "rejected" as const, reviewedAt: now, adminNotes: adminNotes ?? null } : p
      )
    );

    try {
      // Try API server first
      let viaApi = false;
      try {
        await apiCall("POST", `/admin/payments/${id}/reject`, { adminNotes: adminNotes ?? null });
        viaApi = true;
      } catch {
        // API server unavailable — fall back to direct Supabase
      }

      if (!viaApi) {
        const client = await sb();
        checkError(
          await client.from("payment_submissions").update({
            status: "rejected",
            reviewed_at: now,
            ...(adminNotes ? { admin_notes: adminNotes } : {}),
          }).eq("id", id)
        );
      }
    } catch (err) {
      if (sub) {
        setPaymentSubmissions((ps) => ps.map((p) => p.id === id ? sub : p));
      }
      throw err;
    }
  };

  const recordCashPayment = async (memberId: string, month: string, amount: number, note?: string) => {
    const now = new Date().toISOString();
    const bill = calculateMonthlyBill(memberId, month);

    let submissionRow: Record<string, unknown> | null = null;

    // ── Primary path: API server (service-role key, bypasses RLS) ────────────
    let viaApi = false;
    try {
      const resp = await apiCall("POST", "/admin/payments/cash", {
        memberId, month, amount, note: note?.trim() || undefined,
      }) as { submission: Record<string, unknown> };
      submissionRow = resp.submission;
      viaApi = true;
    } catch {
      // API server unreachable — fall through to direct Supabase
    }

    // ── Fallback path: direct Supabase (requires RLS fix in schema.sql) ──────
    if (!viaApi) {
      const client = await sb();
      const baseRow: Record<string, unknown> = {
        member_id: memberId,
        month,
        claimed_amount: amount,
        screenshot_base64: null,
        utr: null,
        status: "approved",
        approved_amount: amount,
        reviewed_at: now,
        ...(note?.trim() ? { admin_notes: note.trim() } : {}),
      };

      let result = await client
        .from("payment_submissions")
        .insert({ ...baseRow, payment_method: "cash" })
        .select()
        .single();

      if (result.error?.message?.includes("payment_method")) {
        result = await client
          .from("payment_submissions")
          .insert(baseRow)
          .select()
          .single();
      }

      submissionRow = getData(result) as Record<string, unknown>;
      // Update bill_payments via the existing helper
      await recordPayment(memberId, month, amount, bill.dueAmount);
    }

    const r = submissionRow!;
    const submission: PaymentSubmission = {
      id: r.id as string,
      memberId: r.member_id as string,
      month: r.month as string,
      claimedAmount: Number(r.claimed_amount),
      screenshotBase64: null,
      utr: null,
      status: "approved",
      approvedAmount: amount,
      submittedAt: r.submitted_at as string,
      reviewedAt: now,
      adminNotes: (r.admin_notes as string | null) ?? null,
      paymentMethod: "cash",
    };
    setPaymentSubmissions((prev) => [submission, ...prev]);

    // When the API server handled it, bill_payments was already updated server-side;
    // still call recordPayment so local state stays consistent.
    if (viaApi) {
      await recordPayment(memberId, month, amount, bill.dueAmount);
    }
  };

  // ── Calculations ──────────────────────────────────────────────────────────
  const getMonthTotals = (month: string) => {
    const monthExpenses = expenses.filter((e) => e.date.startsWith(month));
    const totalExpense = monthExpenses.reduce((s, e) => s + e.amount, 0);
    const monthMeals = meals.filter((m) => m.date.startsWith(month));
    const totalMeals = monthMeals.reduce((s, m) => s + (m.morning ? 1 : 0) + (m.night ? 1 : 0), 0);
    const perMealCost = totalMeals > 0 ? totalExpense / totalMeals : 0;
    return { totalExpense, totalMeals, perMealCost };
  };

  const calculateMonthlyBill = (memberId: string, month: string): MonthlyBill => {
    const member = members.find((m) => m.id === memberId);
    const { perMealCost } = getMonthTotals(month);
    const memberMeals = meals.filter((m) => m.memberId === memberId && m.date.startsWith(month));
    const mealCount = memberMeals.reduce((s, m) => s + (m.morning ? 1 : 0) + (m.night ? 1 : 0), 0);
    const mealBill = mealCount * perMealCost;
    const memberEggs = eggs.filter((e) => e.memberId === memberId && e.date.startsWith(month));
    const eggCount = memberEggs.reduce((s, e) => s + e.count, 0);
    const eggBill = eggCount * settings.eggPrice;
    const cookShare = settings.cookSalary;
    const memberFines = fines.filter((f) => f.memberId === memberId && f.date.startsWith(month));
    const fineTotal = memberFines.reduce((s, f) => s + f.amount, 0);
    const grossBill = mealBill + eggBill + cookShare + fineTotal;
    const memberAdvances = advances.filter((a) => a.memberId === memberId && a.date.startsWith(month));
    const totalAdvance = memberAdvances.reduce((s, a) => s + a.amount, 0);
    const dueAmount = Math.max(0, grossBill - totalAdvance);
    const creditBalance = Math.max(0, totalAdvance - grossBill);
    return {
      memberId, memberName: member?.name ?? "Unknown",
      mealCount, perMealCost, mealBill,
      eggCount, eggBill, cookShare, fineTotal, grossBill,
      totalAdvance, dueAmount, creditBalance,
    };
  };

  const calculateAllMonthlyBills = (month: string): MonthlyBill[] =>
    members.filter((m) => m.status === "active").map((m) => calculateMonthlyBill(m.id, month));

  // ── Weekly Menu Routine ───────────────────────────────────────────────────
  const setRoutineEntry = async (
    dayOfWeek: number,
    mealType: "lunch" | "dinner" | "tiffin",
    items: MenuItem[],
    isSpecial: boolean,
    specialLabel?: string,
  ): Promise<void> => {
    const client = await sb();
    const existing = menuRoutine.find((e) => e.dayOfWeek === dayOfWeek && e.mealType === mealType);
    const row = {
      day_of_week: dayOfWeek,
      meal_type: mealType,
      items,
      is_special: isSpecial,
      special_label: specialLabel ?? null,
      updated_at: new Date().toISOString(),
    };
    if (existing) {
      checkError(await client.from("menu_routine").update(row).eq("id", existing.id));
    } else {
      checkError(await client.from("menu_routine").insert(row));
    }
    await fetchMenuRoutine();
  };

  const deleteRoutineEntry = async (id: string): Promise<void> => {
    const client = await sb();
    setMenuRoutine((prev) => prev.filter((e) => e.id !== id));
    try {
      checkError(await client.from("menu_routine").delete().eq("id", id));
    } catch (err) {
      await fetchMenuRoutine();
      throw err;
    }
  };

  // ── Payment Reminders ─────────────────────────────────────────────────────
  const sendPaymentReminders = async (month: string): Promise<number> => {
    const bills = calculateAllMonthlyBills(month);
    const debtors = bills.filter((b) => b.dueAmount > 0);
    if (debtors.length === 0) return 0;

    for (const debtor of debtors) {
      await addAnnouncement(
        "Payment Reminder",
        `Hello ${debtor.memberName}, your payment for ${month} is still pending. Outstanding amount: ₹${debtor.dueAmount.toFixed(0)}.`,
        "payment_reminder",
        debtor.memberId,
        month,
      );
    }

    await fetchAnnouncements();
    return debtors.length;
  };

  return (
    <DataContext.Provider value={{
      members, meals, expenses, advances, eggs, fines, settings, payments, paymentsError, announcements,
      upiSettings, paymentSubmissions,
      menuRoutine, setRoutineEntry, deleteRoutineEntry,
      isLoaded,
      addMember, updateMember, deleteMember,
      setMeal, setMealsBatch,
      addExpense, updateExpense, deleteExpense,
      addAdvance, deleteAdvance,
      addFine, updateFine, deleteFine,
      setEggEntry, updateSettings,
      addAnnouncement, deleteAnnouncement, sendPaymentReminders,
      markPaid, markUnpaid, recordPayment,
      saveUpiSettings, submitUpiPayment, approvePaymentSubmission, rejectPaymentSubmission, recordCashPayment,
      calculateMonthlyBill, calculateAllMonthlyBills, getMonthTotals,
      refresh: loadAll,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
