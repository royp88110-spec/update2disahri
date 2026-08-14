import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";

interface Props {
  /** Member's display name — used to derive initials and accent colour */
  name?: string;
  /** Remote photo URL — shown when valid, falls back to initials on error */
  photoUrl?: string;
  size?: number;
  /** Override border-radius; defaults to size/2 (full circle) */
  borderRadius?: number;
  /**
   * Override background colour.  When omitted the component picks a
   * consistent colour derived from the first letter of `name` so every
   * member always has a recognisable, distinct avatar.
   */
  bgColor?: string;
  /** Override text/icon colour inside the avatar. Defaults to "#fff". */
  textColor?: string;
}

/** Seven rich palettes spanning the visible spectrum. */
const PALETTES: { bg: string; text: string }[] = [
  { bg: "#2563EB", text: "#fff" }, // royal blue (primary brand)
  { bg: "#7C3AED", text: "#fff" }, // purple
  { bg: "#0891B2", text: "#fff" }, // cyan
  { bg: "#16A34A", text: "#fff" }, // green
  { bg: "#D97706", text: "#fff" }, // amber
  { bg: "#DC2626", text: "#fff" }, // red
  { bg: "#4F46E5", text: "#fff" }, // indigo
];

/**
 * Returns a stable palette for a given name so the same member always gets
 * the same colour, even across sessions (derived purely from char code).
 */
function getPalette(name?: string): { bg: string; text: string } {
  if (!name?.trim()) return PALETTES[0];
  const code = name.trim().toLowerCase().charCodeAt(0);
  return PALETTES[code % PALETTES.length];
}

/**
 * Avatar that renders, in priority order:
 *   1. Photo         — if photoUrl is provided and loads without error
 *   2. Initials      — first character of name, tinted with a name-derived colour
 *   3. User icon     — Feather "user" as a last resort
 *
 * When `bgColor` is NOT passed the component uses a name-derived accent colour
 * so the avatar is always visible regardless of the surrounding background.
 * Pass `bgColor` explicitly (e.g. "rgba(255,255,255,0.2)") to override,
 * which the gradient ScreenHeader does so the colour shows through the gradient.
 */
export function MemberAvatar({
  name,
  photoUrl,
  size = 44,
  borderRadius,
  bgColor,
  textColor,
}: Props) {
  const [imgFailed, setImgFailed] = useState(false);

  // Reset failure state whenever the URL changes so a fresh valid URL
  // gets a new attempt instead of staying in the failed state forever.
  useEffect(() => {
    setImgFailed(false);
  }, [photoUrl]);

  const br = borderRadius ?? size / 2;
  const initials = name?.trim().charAt(0).toUpperCase() ?? "";
  const palette = getPalette(name);

  // Caller-supplied colours take precedence; fall back to name-derived palette.
  const resolvedBg = bgColor ?? palette.bg;
  const resolvedText = textColor ?? palette.text;

  const base = {
    width: size,
    height: size,
    borderRadius: br,
    backgroundColor: resolvedBg,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };

  // ── 1. Photo ──────────────────────────────────────────────────────────────
  if (photoUrl && !imgFailed) {
    return (
      <View style={{ ...base, overflow: "hidden" as const }}>
        <Image
          source={{ uri: photoUrl }}
          style={{ width: size, height: size }}
          onError={() => setImgFailed(true)}
        />
      </View>
    );
  }

  // ── 2. Initials ───────────────────────────────────────────────────────────
  if (initials) {
    // Do NOT add overflow:hidden here — on Android it clips Text rendered
    // inside a rounded View, making the letter invisible.
    return (
      <View style={base}>
        <Text
          style={{
            fontSize: size * 0.42,
            fontWeight: "700",
            color: resolvedText,
            includeFontPadding: false,
          }}
          allowFontScaling={false}
        >
          {initials}
        </Text>
      </View>
    );
  }

  // ── 3. Icon fallback ──────────────────────────────────────────────────────
  return (
    <View style={base}>
      <Feather name="user" size={size * 0.48} color={resolvedText} />
    </View>
  );
}
