import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";

type PremiumCardTone =
  | "lavenderSky"
  | "creamButter"
  | "mintCream"
  | "rosePeach"
  | "lavenderCream"
  | "butterCream"
  | "lavenderRose"
  | "skyMint"
  | "peachCream";

const TONES: Record<PremiumCardTone, { colors: [string, string]; border: string }> = {
  lavenderSky: { colors: ["#EDE4FF", "#E3F4FF"], border: "#D5C8F5" },
  creamButter: { colors: ["#FFF8E7", "#F8E16C"], border: "#E9D58A" },
  mintCream: { colors: ["#DDF8E8", "#FFF8E7"], border: "#BCE8CD" },
  rosePeach: { colors: ["#FFE1E8", "#FFE5D4"], border: "#F2C5CC" },
  lavenderCream: { colors: ["#EDE4FF", "#FFF8E7"], border: "#D8C9F0" },
  butterCream: { colors: ["#F8E16C", "#FFF8E7"], border: "#E6D27A" },
  lavenderRose: { colors: ["#EDE4FF", "#FFE1E8"], border: "#D9C8EF" },
  skyMint: { colors: ["#E3F4FF", "#DDF8E8"], border: "#C1E4E8" },
  peachCream: { colors: ["#FFE5D4", "#FFF8E7"], border: "#F1D0B8" },
};

export function PremiumCard({
  children,
  tone = "lavenderCream",
  style,
}: {
  children: ReactNode;
  tone?: PremiumCardTone;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = TONES[tone];

  return (
    <LinearGradient
      colors={palette.colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        {
          borderRadius: 20,
          borderWidth: 1,
          borderColor: palette.border,
          shadowColor: "#3D2B1F",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 14,
          elevation: 5,
        },
        style,
      ]}
    >
      {children}
    </LinearGradient>
  );
}