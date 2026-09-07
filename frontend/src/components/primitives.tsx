import React from "react";
import { Pressable, Text, View, ViewStyle, StyleProp, TextStyle } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { type as t, dark } from "../theme";

/** 44pt circular icon button. `tone="dark"` = translucent white on a dark canvas. */
export function CircleButton({
  onPress,
  children,
  tone = "light",
  size = 44,
  testID,
  style,
}: {
  onPress?: () => void;
  children: React.ReactNode;
  tone?: "light" | "dark" | "ghost";
  size?: number;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const bg =
    tone === "dark" ? "rgba(255,255,255,0.10)" : tone === "ghost" ? "transparent" : "#FFFFFF";
  const border = tone === "dark" ? "rgba(255,255,255,0.10)" : tone === "ghost" ? "transparent" : "#E6EAF0";
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          borderWidth: 1,
          borderColor: border,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.7 : 1,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

export function BackButton({ onPress, tone = "light", testID }: { onPress: () => void; tone?: "light" | "dark"; testID?: string }) {
  return (
    <CircleButton onPress={onPress} tone={tone} testID={testID}>
      <ChevronLeft size={22} color={tone === "dark" ? dark.text : "#0B192C"} strokeWidth={2.2} />
    </CircleButton>
  );
}

/** Small uppercase tracking label */
export function Eyebrow({ children, color = "#64748B", style }: { children: React.ReactNode; color?: string; style?: StyleProp<TextStyle> }) {
  return <Text style={[t.eyebrow, { color }, style]}>{children}</Text>;
}

/** Soft pill tag used in agency cards */
export function Tag({ label, dark: isDark }: { label: string; dark?: boolean }) {
  return (
    <View
      style={{
        paddingHorizontal: 10,
        height: 26,
        borderRadius: 13,
        backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#EEF2F7",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "600", color: isDark ? dark.textSecondary : "#475569" }}>{label}</Text>
    </View>
  );
}

/** Agency monogram square */
export function Monogram({ code, bg, fg, size = 44, radius = 13 }: { code: string; bg: string; fg: string; size?: number; radius?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: fg, fontWeight: "800", fontSize: code.length > 3 ? 10 : 12, letterSpacing: 0.3 }}>{code}</Text>
    </View>
  );
}

/** Horizontal header for a stacked screen: back button + title */
export function ScreenHeader({
  title,
  onBack,
  tone = "light",
  right,
  testID,
}: {
  title?: string;
  onBack: () => void;
  tone?: "light" | "dark";
  right?: React.ReactNode;
  testID?: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, height: 60, gap: 14 }}>
      <BackButton onPress={onBack} tone={tone} testID={testID} />
      {title ? (
        <Text style={[t.title3, { color: tone === "dark" ? dark.text : "#0B192C", flex: 1 }]} numberOfLines={1}>
          {title}
        </Text>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      {right}
    </View>
  );
}
