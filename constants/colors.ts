// ─── Design Tokens — Pastel Gradient Theme ────────────────────────────────────

const colors = {
  light: {
    text: "#1E1B4B",
    tint: "#4F46E5",
    /** Fallback only — screens use a LinearGradient background */
    background: "#DDF5FF",
    foreground: "#1E1B4B",
    /** Glass-white card surface */
    card: "rgba(255,255,255,0.92)",
    cardForeground: "#1E1B4B",
    primary: "#4F46E5",
    primaryForeground: "#FFFFFF",
    secondary: "#EDE9FE",
    secondaryForeground: "#4F46E5",
    /** Input / chip background */
    muted: "rgba(248,250,252,0.82)",
    mutedForeground: "#6B7280",
    accent: "#38BDF8",
    accentForeground: "#0C4A6E",
    destructive: "#F43F5E",
    destructiveForeground: "#FFFFFF",
    /** Subtle divider / card border */
    border: "rgba(148,163,184,0.22)",
    /** TextInput border */
    input: "rgba(148,163,184,0.32)",
    success: "#34D399",
    successForeground: "#FFFFFF",
    warning: "#FACC15",
    warningForeground: "#FFFFFF",
  },

  dark: {
    text: "#E2E8F0",
    tint: "#818CF8",
    background: "#0A0F1E",
    foreground: "#E2E8F0",
    card: "#111827",
    cardForeground: "#E2E8F0",
    primary: "#818CF8",
    primaryForeground: "#FFFFFF",
    secondary: "#1E1B4B",
    secondaryForeground: "#A5B4FC",
    muted: "#1E293B",
    mutedForeground: "#64748B",
    accent: "#38BDF8",
    accentForeground: "#DBEAFE",
    destructive: "#F43F5E",
    destructiveForeground: "#FFFFFF",
    border: "#1E293B",
    input: "#1E293B",
    success: "#34D399",
    successForeground: "#FFFFFF",
    warning: "#FACC15",
    warningForeground: "#0F172A",
  },

  radius: 20,
};

export default colors;

// ─── Global Palette Constants ──────────────────────────────────────────────────
export const PRIMARY       = "#4F46E5";
export const PRIMARY2      = "#7C3AED";
export const BG_GRADIENT   = ["#7DE7D8", "#B7F5E7", "#DDF5FF"] as const;
export const HEADER_GRADIENT = ["#4F46E5", "#7C3AED"] as const;

// Accent shades
export const SKY    = "#38BDF8";
export const CYAN   = "#22D3EE";
export const EMERALD = "#34D399";
export const PINK   = "#EC4899";
export const ORANGE = "#FB923C";
export const YELLOW = "#FACC15";
export const RED    = "#F43F5E";

// Card glass style (spread into StyleSheet objects)
export const GLASS_CARD = {
  backgroundColor: "rgba(255,255,255,0.92)" as const,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.6)" as const,
} as const;

export const CARD_SHADOW = {
  shadowColor: "#4F46E5" as const,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.10,
  shadowRadius: 16,
  elevation: 6,
} as const;
