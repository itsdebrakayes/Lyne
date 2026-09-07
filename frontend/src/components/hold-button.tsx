import React, { useRef, useState } from "react";
import { Animated, Pressable, Text, View, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { dark } from "../theme";

const HOLD_MS = 1100;

/**
 * Press-and-hold confirmation button. The fill sweeps left → right while held;
 * releasing early resets. Calls `onComplete` once the sweep finishes.
 */
export function HoldButton({
  label,
  holdingLabel = "Keep holding…",
  disabled,
  disabledLabel,
  onComplete,
  testID,
}: {
  label: string;
  holdingLabel?: string;
  disabled?: boolean;
  disabledLabel?: string;
  onComplete: () => void;
  testID?: string;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const [holding, setHolding] = useState(false);
  const [width, setWidth] = useState(0);
  const anim = useRef<Animated.CompositeAnimation | null>(null);

  const haptic = (style: "light" | "success") => {
    if (Platform.OS === "web") return;
    if (style === "light") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const start = () => {
    if (disabled) return;
    setHolding(true);
    haptic("light");
    anim.current = Animated.timing(progress, { toValue: 1, duration: HOLD_MS, useNativeDriver: false });
    anim.current.start(({ finished }) => {
      if (finished) {
        haptic("success");
        setHolding(false);
        onComplete();
        progress.setValue(0);
      }
    });
  };

  const cancel = () => {
    anim.current?.stop();
    setHolding(false);
    Animated.timing(progress, { toValue: 0, duration: 160, useNativeDriver: false }).start();
  };

  const fillWidth = progress.interpolate({ inputRange: [0, 1], outputRange: [0, width || 1] });

  return (
    <Pressable
      testID={testID}
      onPressIn={start}
      onPressOut={cancel}
      // Long-press on web/desktop testers: a plain press also completes after hold
      onLongPress={() => {}}
      delayLongPress={HOLD_MS}
      disabled={disabled}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{
        height: 58,
        borderRadius: 18,
        overflow: "hidden",
        backgroundColor: disabled ? "rgba(29,78,216,0.28)" : dark.accent,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: fillWidth,
          backgroundColor: "rgba(255,255,255,0.22)",
        }}
      />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text
          style={{
            color: disabled ? "rgba(255,255,255,0.45)" : "#FFFFFF",
            fontSize: 16,
            fontWeight: "700",
            letterSpacing: -0.2,
          }}
        >
          {disabled ? disabledLabel ?? label : holding ? holdingLabel : label}
        </Text>
      </View>
    </Pressable>
  );
}
