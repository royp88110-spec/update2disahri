import { registerForPushNotifications } from "@/lib/registerForPushNotifications";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";
import { isSupabaseConfigured, toEmail } from "@/lib/supabase";

export interface AuthUser {
  id: string;
  name: string;
  role: "admin" | "member";
  memberId: string;
  photoUrl?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  /** Returns the resolved AuthUser on success, null on failure. */
  login: (identifier: string, password: string) => Promise<AuthUser | null>;
  logout: () => Promise<void>;
  isLoading: boolean;
  needsSetup: boolean;
  schemaNotReady: boolean;
  supabaseReady: boolean;
  refreshSetupStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const getApiBase = (): string => {
  if (Platform.OS === "web") return "";
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (apiUrl) return apiUrl.replace(/\/$/, "");
  const domain = process.env.EXPO_PUBLIC_DOMAIN ?? "";
  return domain ? `https://${domain}` : "";
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [schemaNotReady, setSchemaNotReady] = useState(false);
  const [supabaseReady] = useState(isSupabaseConfigured);

  // Prevents onAuthStateChange from calling loadMemberForSession a second time
  // when login() is already doing it explicitly.
  const loggingIn = useRef(false);

  const registerPushForUser = useCallback(async (resolvedUser: AuthUser | null) => {
    if (!resolvedUser || resolvedUser.role !== "member" || !resolvedUser.memberId) {
      return;
    }

    try {
      const pushToken = await registerForPushNotifications(resolvedUser.memberId);
      console.log("[Auth] Push registration result", {
        memberId: resolvedUser.memberId,
        tokenGenerated: Boolean(pushToken),
        tokenPrefix: pushToken?.slice(0, 24) ?? null,
      });
    } catch (error) {
      console.error("[Auth] Push registration failed", {
        memberId: resolvedUser.memberId,
        error,
      });
    }
  }, []);

  const refreshSetupStatus = useCallback(async () => {
    if (!supabaseReady) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(`${getApiBase()}/api/setup/status`, { signal: controller.signal });
      const data = (await res.json()) as { needsSetup?: boolean; schemaNotReady?: boolean };
      if (data.schemaNotReady) {
        setSchemaNotReady(true);
        setNeedsSetup(false);
      } else {
        setSchemaNotReady(false);
        setNeedsSetup(data.needsSetup ?? false);
      }
    } catch {
      // Timeout, network error, or server unreachable — treat as "not needed".
      setNeedsSetup(false);
    } finally {
      clearTimeout(timer);
    }
  }, [supabaseReady]);

  /**
   * Fetches the member row for a Supabase session user and updates user state.
   * Returns the resolved AuthUser, or null if the member row is missing.
   */
  const loadMemberForSession = useCallback(async (
    userId: string | undefined,
    userMeta?: Record<string, unknown>,
  ): Promise<AuthUser | null> => {
    if (!userId || !supabaseReady) {
      setUser(null);
      return null;
    }
    const { getSupabase } = await import("@/lib/supabase");
    const sb = getSupabase();
    const { data: member } = await sb
      .from("members")
      .select("id, name, role")
      .eq("user_id", userId)
      .single();

    if (member) {
      const rawPhoto = userMeta?.avatar_url ?? userMeta?.picture;
      const photoUrl = typeof rawPhoto === "string" && rawPhoto ? rawPhoto : undefined;
      const newUser: AuthUser = {
        id: userId,
        name: member.name as string,
        role: member.role as "admin" | "member",
        memberId: member.id as string,
        photoUrl: photoUrl || undefined,
      };
      setUser(newUser);
      setNeedsSetup(false);
      return newUser;
    } else {
      setUser(null);
      await sb.auth.signOut();
      return null;
    }
  }, [supabaseReady]);

  useEffect(() => {
    if (!supabaseReady) {
      setIsLoading(false);
      return;
    }

    let mounted = true;

   const init = async () => {
  try {
    const { getSupabase } = await import("@/lib/supabase");
    const sb = getSupabase();

    const { data: { session } } = await sb.auth.getSession();

    if (mounted) {
      const resolvedUser = await loadMemberForSession(
        session?.user.id,
        session?.user.user_metadata
      );
      if (mounted) {
        void registerPushForUser(resolvedUser);
      }
    }

    // Setup status background-এ check হবে,
    // automatic login-এর জন্য অপেক্ষা করবে না।
    void refreshSetupStatus();

  } catch {
    if (mounted) setUser(null);
  } finally {
    if (mounted) setIsLoading(false);
  }
};

    void init();

    // Register onAuthStateChange AFTER init so INITIAL_SESSION doesn't race
    // with getSession(). The listener handles token refreshes and sign-outs
    // that happen while the app is running; explicit login is handled by login().
    let unsubscribe: (() => void) | null = null;
    import("@/lib/supabase").then(({ getSupabase }) => {
      const sb = getSupabase();
      const { data: { subscription } } = sb.auth.onAuthStateChange(
        (_event, session) => {
          // Skip if login() is currently executing — it calls loadMemberForSession
          // directly and we don't want a duplicate fetch + extra setUser call.
          if (loggingIn.current) return;
          void loadMemberForSession(session?.user.id, session?.user.user_metadata);
        },
      );
      unsubscribe = () => subscription.unsubscribe();
    });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [loadMemberForSession, refreshSetupStatus, registerPushForUser, supabaseReady]);

  /**
   * Signs in with Supabase, loads the member profile, and returns the resolved
   * AuthUser. Returns null on bad credentials or missing member row.
   * The caller can navigate directly using the returned user.role without
   * waiting for AuthGuard's useEffect to fire.
   */
  const login = async (identifier: string, password: string): Promise<AuthUser | null> => {
    if (!supabaseReady) return null;
    const { getSupabase } = await import("@/lib/supabase");
    const { data, error } = await getSupabase().auth.signInWithPassword({
      email: toEmail(identifier),
      password,
    });
    if (error || !data.session) return null;
    // Flag so onAuthStateChange skips its duplicate loadMemberForSession call.
    loggingIn.current = true;
    const result = await loadMemberForSession(
  data.session.user.id,
  data.session.user.user_metadata
);
    await registerPushForUser(result);

loggingIn.current = false;

return result;
  };

  const logout = async () => {
    if (supabaseReady) {
      try {
        const { getSupabase } = await import("@/lib/supabase");
        await getSupabase().auth.signOut();
      } catch {
        // Ignore network errors on sign-out — we still clear local state.
      }
    }

    setUser(null);

    try {
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      const allKeys = await AsyncStorage.getAllKeys();
      const authKeys = allKeys.filter(
        (k) => k.startsWith("sb-") || k.includes("supabase") || k.includes("auth"),
      );
      if (authKeys.length > 0) {
        await AsyncStorage.multiRemove(authKeys);
      }
    } catch {
      // AsyncStorage cleanup is best-effort; ignore failures.
    }
  };

  return (
    <AuthContext.Provider value={{
      user, login, logout, isLoading, needsSetup, schemaNotReady, supabaseReady, refreshSetupStatus,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
