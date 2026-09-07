import React from "react";
import { View } from "react-native";

// Deterministic faux Code-128-style barcode (purely visual).
const PATTERN =
  "2112331121123211213112211321311221123112112132211312213121121321123112211231213211231121312211321121";

export function Barcode({ color = "#0B192C", height = 72 }: { color?: string; height?: number }) {
  const bars = PATTERN.split("").map((c) => Number(c));
  return (
    <View style={{ flexDirection: "row", height, alignItems: "stretch", justifyContent: "center" }}>
      {bars.map((w, i) => (
        <View
          key={i}
          style={{
            width: w,
            backgroundColor: i % 2 === 0 ? color : "transparent",
          }}
        />
      ))}
    </View>
  );
}
