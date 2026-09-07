import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, ScrollView, Pressable, StyleSheet, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Store } from "lucide-react-native";
import { dark, type as t } from "@/src/theme";
import { serviceById, branchById, LINE_STATS, SERVICES, BRANCHES } from "@/src/data/mock";
import { ScreenHeader } from "@/src/components/primitives";

const NAVY = "#0B192C";
const BLUE = "#1D4ED8";
const OPEN = "#EEF2F7";
const YOU = "#C3CAD6";

type Dot = "counter" | "waiting" | "you" | "open";
const DOT = 50;
const ROW_GAP = 20;

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function LineNow() {
  const { serviceId, branchId, agencyId, arrival } = useLocalSearchParams<{ serviceId: string; branchId: string; agencyId?: string; arrival?: string }>();
  const router = useRouter();
  const svc = serviceById(serviceId!) ?? SERVICES[0];
  const branch = branchById(branchId!) ?? BRANCHES[0];
  const stats = LINE_STATS[svc.id];

  // Build the dot sequence: one dot per open counter, then people waiting, then you, then open spots.
  const openCounters = Math.max(1, Math.min(stats.counters, 3));
  const dots: Dot[] = [
    ...Array<Dot>(openCounters).fill("counter"),
    ...Array<Dot>(stats.inLine).fill("waiting"),
    "you",
  ];
  const perRow = 5;
  const rows = Math.max(2, Math.ceil((dots.length + 1) / perRow));
  while (dots.length < rows * perRow) dots.push("open");
  const youIndex = dots.indexOf("you");

  const spot = stats.inLine + 1;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: dark.bg }} edges={["top"]}>
      <StatusBar barStyle="light-content" />
      <ScreenHeader testID="line-back-btn" tone="dark" title="The line right now" onBack={() => router.back()} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 12 }}>
        {/* Visualiser card */}
        <View style={styles.card}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <Text style={[t.title2, { color: NAVY, flex: 1 }]} numberOfLines={1}>
              {svc.name}
            </Text>
            <View style={styles.branchBox}>
              <Text style={[t.eyebrow, { color: "#64748B", fontSize: 10 }]}>Branch</Text>
              <Text style={{ color: NAVY, fontWeight: "700", fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                {branch.name}
              </Text>
            </View>
          </View>

          <View style={styles.counterBar}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Store size={16} color="#fff" strokeWidth={2} />
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13, letterSpacing: 0.6 }}>
                COUNTERS · {openCounters} OPEN
              </Text>
            </View>
            <Text style={{ color: "#C7D7FB", fontSize: 12, fontWeight: "500" }}>
              {stats.inLine} waiting
            </Text>
          </View>

          {/* Dot grid */}
          <View style={{ marginTop: 18 }}>
            {Array.from({ length: rows }).map((_, r) => (
              <View key={r} style={{ flexDirection: "row", alignItems: "center", marginTop: r === 0 ? 0 : ROW_GAP }}>
                {/* vertical connector down to the next row (painted first so dots sit on top) */}
                {r < rows - 1 && (
                  <View
                    pointerEvents="none"
                    style={{ position: "absolute", right: DOT / 2 - 2, top: DOT / 2, width: 4, height: DOT + ROW_GAP, backgroundColor: OPEN }}
                  />
                )}
                {dots.slice(r * perRow, (r + 1) * perRow).map((d, c) => {
                  const idx = r * perRow + c;
                  return [
                    <View key={`d${idx}`} style={{ width: DOT, height: DOT, alignItems: "center", justifyContent: "center" }}>
                      {idx === youIndex && (
                        <Text style={{ position: "absolute", top: -22, color: "#94A3B8", fontSize: 14 }}>↓</Text>
                      )}
                      <View
                        style={[
                          styles.dot,
                          d === "counter" && { backgroundColor: BLUE },
                          d === "waiting" && { backgroundColor: NAVY },
                          d === "open" && { backgroundColor: OPEN },
                          d === "you" && { backgroundColor: YOU, borderWidth: 2.5, borderStyle: "dashed", borderColor: NAVY },
                        ]}
                      />
                    </View>,
                    c < perRow - 1 ? <View key={`c${idx}`} style={{ flex: 1, height: 4, backgroundColor: OPEN }} /> : null,
                  ];
                })}
              </View>
            ))}
          </View>

          {/* Legend */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 24 }}>
            <Legend color={BLUE} label="At the counter" />
            <Legend color={NAVY} label="Waiting" />
            <Legend color={YOU} dashed label="You'd be here" />
            <Legend color={OPEN} label="Open spot" />
          </View>
        </View>

        {/* Stats */}
        <View style={[styles.card, { flexDirection: "row", paddingVertical: 18 }]}>
          <Stat label="Your spot" value={ordinal(spot)} />
          <Stat label="Ahead" value={String(stats.inLine)} />
          <Stat label="Est. wait" value={`${stats.waitMins} min`} />
        </View>

        <Pressable
          testID="line-join-btn"
          onPress={() => router.push(`/join/ready?serviceId=${svc.id}&branchId=${branch.id}&agencyId=${agencyId ?? "a1"}&arrival=${arrival ?? "now"}`)}
          style={({ pressed }) => [styles.primary, { opacity: pressed ? 0.9 : 1 }]}
        >
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700", letterSpacing: -0.2 }}>Join this line</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: color, borderWidth: dashed ? 1.5 : 0, borderStyle: "dashed", borderColor: NAVY }} />
      <Text style={{ color: "#475569", fontSize: 13, fontWeight: "500" }}>{label}</Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[t.eyebrow, { color: "#64748B" }]}>{label}</Text>
      <Text style={{ color: NAVY, fontSize: 22, fontWeight: "800", letterSpacing: -0.5, marginTop: 6 }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 20 },
  branchBox: { backgroundColor: "#F3F5F9", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, maxWidth: "58%" },
  counterBar: {
    marginTop: 18,
    height: 44,
    borderRadius: 14,
    backgroundColor: NAVY,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  primary: { height: 58, borderRadius: 18, backgroundColor: dark.accent, alignItems: "center", justifyContent: "center", marginTop: 4 },
});
