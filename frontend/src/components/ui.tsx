import React from "react";
import { Pressable, StyleSheet, Text, View, ActivityIndicator } from "react-native";
import { useTheme, radius, spacing, fonts, shadow, type as t } from "../theme";

type Variant = "primary" | "secondary" | "tertiary" | "destructive";
type Size = "lg" | "md" | "sm";

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "lg",
  disabled,
  loading,
  icon,
  fullWidth = true,
  testID,
}: {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();

  const bg = {
    primary: colors.brandPrimary,
    secondary: colors.brandSecondary,
    tertiary: "transparent",
    destructive: colors.warning,
  }[variant];

  const fg = {
    primary: colors.onBrandPrimary,
    secondary: colors.onBrandSecondary,
    tertiary: colors.brandPrimary,
    destructive: colors.onWarning,
  }[variant];

  const paddingV = size === "lg" ? 16 : size === "md" ? 12 : 10;
  const fontSize = size === "lg" ? 16 : size === "md" ? 15 : 14;
  const isGhost = variant === "tertiary";

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          opacity: disabled ? 0.45 : pressed ? 0.88 : 1,
          borderRadius: 18,
          paddingVertical: paddingV,
          paddingHorizontal: spacing.lg,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.sm,
          alignSelf: fullWidth ? "stretch" : "flex-start",
          minHeight: size === "lg" ? 56 : 48,
          borderWidth: isGhost ? 1.5 : 0,
          borderColor: colors.border,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon}
          <Text
            style={{
              color: fg,
              fontSize,
              fontWeight: "700",
              letterSpacing: -0.2,
            }}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function Card({ children, style, testID, onPress }: any) {
  const { colors } = useTheme();
  const inner = (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: colors.surfaceSecondary,
          borderRadius: radius.xl,
          padding: spacing.md,
        },
        shadow.card,
        style,
      ]}
    >
      {children}
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}>
        {inner}
      </Pressable>
    );
  }
  return inner;
}

export function StatusChip({
  label,
  tone = "info",
  icon,
  testID,
}: {
  label: string;
  tone?: "info" | "success" | "warning" | "error" | "neutral";
  icon?: React.ReactNode;
  testID?: string;
}) {
  const { colors } = useTheme();
  const map = {
    info: { bg: colors.brandSecondary, fg: colors.onBrandSecondary },
    success: { bg: "#DCFCE7", fg: "#166534" },
    warning: { bg: "#FEE2E2", fg: "#B91C1C" },
    error: { bg: "#FEE2E2", fg: "#991B1B" },
    neutral: { bg: colors.surfaceTertiary, fg: colors.muted },
  }[tone];
  return (
    <View
      testID={testID}
      style={{
        backgroundColor: map.bg,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: radius.pill,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        alignSelf: "flex-start",
      }}
    >
      {icon}
      <Text style={{ color: map.fg, fontSize: 12, fontWeight: "600", fontFamily: fonts.semibold }}>
        {label}
      </Text>
    </View>
  );
}

export function ProgressBar({ value, testID }: { value: number; testID?: string }) {
  const { colors } = useTheme();
  const pct = Math.min(1, Math.max(0, value));
  return (
    <View
      testID={testID}
      style={{
        height: 6,
        borderRadius: 999,
        backgroundColor: colors.surfaceTertiary,
        overflow: "hidden",
      }}
    >
      <View style={{ width: `${pct * 100}%`, height: "100%", backgroundColor: colors.brandPrimary }} />
    </View>
  );
}

export function SectionHeader({
  title,
  action,
  onAction,
  testID,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      testID={testID}
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 20,
        marginTop: 28,
        marginBottom: 12,
      }}
    >
      <Text style={[t.title3, { color: colors.onSurface }]}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={{ color: colors.brandPrimary, fontSize: 14, fontWeight: "600" }}>
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({
  title,
  body,
  icon,
  action,
  onAction,
}: {
  title: string;
  body?: string;
  icon?: React.ReactNode;
  action?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.xl,
        gap: spacing.sm,
      }}
    >
      {icon}
      <Text
        style={{
          fontSize: 18,
          fontWeight: "700",
          color: colors.onSurface,
          fontFamily: fonts.bold,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      {body ? (
        <Text style={{ color: colors.muted, textAlign: "center", fontFamily: fonts.regular }}>
          {body}
        </Text>
      ) : null}
      {action ? (
        <View style={{ marginTop: spacing.md, alignSelf: "stretch" }}>
          <Button label={action} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

const _ = StyleSheet.create({ hidden: { display: "none" } });
export default _;
