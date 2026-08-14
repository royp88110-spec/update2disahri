import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_client) {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("SUPABASE_NOT_CONFIGURED");
    }

    _client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        storage: AsyncStorage as any,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return _client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return getSupabase()[prop as keyof SupabaseClient];
  },
});

export const toEmail = (identifier: string): string => {
  const id = identifier.trim().toLowerCase();
  return id.includes("@") ? id : `${id}@dishari.app`;
};

export const isSupabaseConfigured = (): boolean =>
  !!(process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
