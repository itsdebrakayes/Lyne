import React from "react";
import { View, useWindowDimensions } from "react-native";
import { Ticket, Clock, Users, MapPin, Navigation, Sparkles, CheckCheck, QrCode, Bell } from "lucide-react-native";

const NAVY = "#0B192C";
const BLUE = "#1D4ED8";

type Tile = { x: number; y: number; size: number; rotate: number; bg: string; fg: string; Icon: any; opacity?: number };

/**
 * Decorative rows of tilted app-icon tiles hugging the top and bottom edges of an auth screen.
 * Positions are relative to screen width so they sit consistently across devices.
 */
export function TileBackdrop() {
  const { width, height } = useWindowDimensions();
  const top: Tile[] = [
    { x: -0.06, y: -0.02, size: 84, rotate: -14, bg: NAVY, fg: "#fff", Icon: Ticket },
    { x: 0.2, y: -0.045, size: 78, rotate: 8, bg: "#fff", fg: NAVY, Icon: Clock },
    { x: 0.44, y: -0.07, size: 86, rotate: -6, bg: BLUE, fg: "#fff", Icon: Users },
    { x: 0.7, y: -0.05, size: 80, rotate: 12, bg: "#fff", fg: BLUE, Icon: MapPin },
    { x: 0.93, y: -0.03, size: 76, rotate: -10, bg: NAVY, fg: "#fff", Icon: Bell },
  ];
  const bottom: Tile[] = [
    { x: -0.05, y: 0.94, size: 80, rotate: 10, bg: NAVY, fg: "#fff", Icon: QrCode },
    { x: 0.2, y: 0.955, size: 84, rotate: -8, bg: BLUE, fg: "#fff", Icon: Users },
    { x: 0.45, y: 0.965, size: 78, rotate: 6, bg: "#fff", fg: BLUE, Icon: Sparkles },
    { x: 0.68, y: 0.945, size: 82, rotate: -12, bg: BLUE, fg: "#fff", Icon: Navigation },
    { x: 0.9, y: 0.93, size: 84, rotate: 9, bg: NAVY, fg: "#fff", Icon: CheckCheck },
  ];
  const all = [...top, ...bottom];
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
      {all.map((tile, i) => {
        const Icon = tile.Icon;
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              left: tile.x * width,
              top: tile.y * height,
              width: tile.size,
              height: tile.size,
              borderRadius: tile.size * 0.28,
              backgroundColor: tile.bg,
              alignItems: "center",
              justifyContent: "center",
              transform: [{ rotate: `${tile.rotate}deg` }],
              opacity: 0.92,
              borderWidth: tile.bg === "#fff" ? 1 : 0,
              borderColor: "#E6EAF0",
            }}
          >
            <Icon size={tile.size * 0.4} color={tile.fg} strokeWidth={1.8} />
          </View>
        );
      })}
      {/* Fade tiles into the canvas so content stays legible */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: height * 0.16, backgroundColor: "rgba(243,245,249,0.35)" }} />
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: height * 0.14, backgroundColor: "rgba(243,245,249,0.35)" }} />
    </View>
  );
}
