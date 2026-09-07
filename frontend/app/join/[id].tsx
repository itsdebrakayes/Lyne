import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, ScrollView, Pressable, StyleSheet, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronDown, ArrowDown, ArrowRight, Bookmark, CalendarClock } from "lucide-react-native";
import { dark, type as t } from "@/src/theme";
import { serviceById, branchById, BRANCHES, SERVICES, LINE_STATS, agencyById } from "@/src/data/mock";
import { BackButton, CircleButton, Monogram } from "@/src/components/primitives";
import { OptionSheet } from "@/src/components/option-sheet";
import { useAppStore, setState } from "@/src/store/app-store";

function nowLabel() {
  const d = new Date();
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

export default function JoinSetup() {
  const { id, branchId: initialBranchId, agencyId } = useLocalSearchParams<{ id: string; branchId?: string; agencyId?: string }>();
  const router = useRouter();
  const [branchId, setBranchId] = useState(initialBranchId || BRANCHES[0].id);
  const [serviceId, setServiceId] = useState(id || SERVICES[0].id);
  const [arrival, setArrival] = useState<"now" | "later">("now");
  const [sheet, setSheet] = useState<"branch" | "service" | null>(null);
  const saved = useAppStore((s) => s.savedBranchIds);

  const branch = branchById(branchId) ?? BRANCHES[0];
  const svc = serviceById(serviceId) ?? SERVICES[0];
  const agency = agencyById(agencyId || "a1")!;
  const stats = LINE_STATS[svc.id];
  const isSaved = saved.includes(branch.id);

  const openBranches = BRANCHES.filter((b) => b.status !== "closed");
  const branchServices = SERVICES.filter((s) => branch.services.includes(s.id));

  const goToLine = (sid = svc.id) =>
    router.push(`/join/line?serviceId=${sid}&branchId=${branch.id}&agencyId=${agency.id}&arrival=${arrival}`);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: dark.bg }} edges={["top"]}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        {/* Header */}
        <View style={styles.header}>
          <BackButton testID="join-back-btn" tone="dark" onPress={() => router.back()} />
          <Text style={[t.title1, { color: dark.text, flex: 1, marginLeft: 14 }]}>Let's get you{"\n"}in line</Text>
          <CircleButton
            testID="join-save-btn"
            tone="dark"
            onPress={() =>
              setState({ savedBranchIds: isSaved ? saved.filter((x) => x !== branch.id) : [...saved, branch.id] })
            }
          >
            <Bookmark size={19} color="#fff" fill={isSaved ? "#fff" : "transparent"} strokeWidth={1.9} />
          </CircleButton>
        </View>

        {/* Selectors */}
        <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
          <Pressable testID="join-branch-selector" onPress={() => setSheet("branch")} style={({ pressed }) => [styles.selector, { opacity: pressed ? 0.92 : 1 }]}>
            <Text style={styles.selectorLabel}>Branch</Text>
            <View style={{ flex: 1 }}>
              <Text style={[t.title2, { color: "#0B192C" }]} numberOfLines={1}>
                {branch.area.startsWith("Kingston") ? `Kingston - ${branch.name}` : branch.name}
              </Text>
              <Text style={[t.footnote, { color: "#64748B", marginTop: 3 }]}>
                {branch.area} · {branch.status === "closing_soon" ? "Closing soon" : `Open until ${branch.hoursToday.split("–").pop()?.trim()}`}
              </Text>
            </View>
            <ChevronDown size={18} color="#94A3B8" strokeWidth={2} />
          </Pressable>

          <View style={styles.swapWrap} pointerEvents="none">
            <View style={styles.swap}>
              <ArrowDown size={18} color="#fff" strokeWidth={2.4} />
            </View>
          </View>

          <Pressable testID="join-service-selector" onPress={() => setSheet("service")} style={({ pressed }) => [styles.selector, { opacity: pressed ? 0.92 : 1 }]}>
            <Text style={styles.selectorLabel}>Service</Text>
            <View style={{ flex: 1 }}>
              <Text style={[t.title2, { color: "#0B192C" }]} numberOfLines={1}>
                {svc.name}
              </Text>
              <Text style={[t.footnote, { color: "#64748B", marginTop: 3 }]}>{branchServices.length} available today</Text>
            </View>
            <ChevronDown size={18} color="#94A3B8" strokeWidth={2} />
          </Pressable>
        </View>

        {/* Arrival */}
        <View style={{ flexDirection: "row", paddingHorizontal: 20, marginTop: 16, gap: 10 }}>
          <Pressable
            testID="join-arrive-now"
            onPress={() => setArrival("now")}
            style={[styles.arrive, arrival === "now" ? { backgroundColor: dark.accent } : styles.arriveGhost]}
          >
            <Text style={[t.caption, { color: arrival === "now" ? "#C7D7FB" : dark.muted }]}>Arriving</Text>
            <Text style={[t.headline, { color: arrival === "now" ? "#fff" : dark.text, marginTop: 2 }]}>Now · {nowLabel()}</Text>
          </Pressable>
          <Pressable
            testID="join-arrive-later"
            onPress={() => setArrival("later")}
            style={[styles.arrive, styles.arriveLater, arrival === "later" ? { backgroundColor: dark.accent, borderColor: dark.accent } : null]}
          >
            <CalendarClock size={16} color={arrival === "later" ? "#fff" : dark.muted} strokeWidth={2} />
            <Text style={[t.headline, { color: arrival === "later" ? "#fff" : dark.muted }]}>Later</Text>
          </Pressable>
        </View>

        {/* Primary */}
        <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
          <Pressable testID="join-see-line-btn" onPress={() => goToLine()} style={({ pressed }) => [styles.primary, { opacity: pressed ? 0.9 : 1 }]}>
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700", letterSpacing: -0.2 }}>
              See the line · {stats.waitMins}m
            </Text>
            <ArrowRight size={18} color="#fff" strokeWidth={2.4} />
          </Pressable>
        </View>

        {/* Open lines */}
        <Text style={[t.title2, { color: dark.text, paddingHorizontal: 20, marginTop: 30, marginBottom: 12 }]}>Open lines</Text>
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          {branchServices.map((s) => {
            const st = LINE_STATS[s.id];
            const active = s.id === svc.id;
            return (
              <Pressable
                key={s.id}
                testID={`join-line-${s.id}`}
                onPress={() => (active ? goToLine(s.id) : setServiceId(s.id))}
                style={({ pressed }) => [styles.lineCard, active ? { backgroundColor: dark.accent } : { backgroundColor: "#FFFFFF" }, { opacity: pressed ? 0.92 : 1 }]}
              >
                <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[t.eyebrow, { color: active ? "#C7D7FB" : "#64748B" }]}>{active ? "Tap again to see the line" : "Join now"}</Text>
                    <Text style={[t.title2, { color: active ? "#fff" : "#0B192C", marginTop: 6 }]} numberOfLines={1}>
                      {s.name}
                    </Text>
                  </View>
                  <Monogram code={agency.code} bg={active ? "#FFFFFF" : "#0B192C"} fg={active ? dark.accent : "#FFFFFF"} size={44} radius={22} />
                </View>
                <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 22 }}>
                  <Text style={[t.footnote, { color: active ? "#C7D7FB" : "#64748B", fontWeight: "500" }]}>
                    {st.inLine} in line · {st.counters} counter{st.counters === 1 ? "" : "s"}
                  </Text>
                  <Text style={{ color: active ? "#fff" : "#0B192C", fontSize: 22, fontWeight: "800", letterSpacing: -0.5 }}>{st.waitMins} min</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <OptionSheet
        testID="branch-sheet"
        visible={sheet === "branch"}
        title="Choose a branch"
        selectedId={branch.id}
        options={openBranches.map((b) => ({ id: b.id, label: b.name, sub: `${b.area} · ${b.distanceKm} km · ~${b.shortestWaitMins}m wait` }))}
        onClose={() => setSheet(null)}
        onSelect={(bid) => {
          setBranchId(bid);
          const nb = branchById(bid)!;
          if (!nb.services.includes(serviceId)) setServiceId(nb.services[0]);
          setSheet(null);
        }}
      />
      <OptionSheet
        testID="service-sheet"
        visible={sheet === "service"}
        title="Choose a service"
        selectedId={svc.id}
        options={branchServices.map((s) => ({ id: s.id, label: s.name, sub: `${LINE_STATS[s.id].inLine} in line · ~${LINE_STATS[s.id].waitMins} min` }))}
        onClose={() => setSheet(null)}
        onSelect={(sid) => {
          setServiceId(sid);
          setSheet(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 20, paddingTop: 10, gap: 6 },
  selector: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 84,
  },
  selectorLabel: { width: 58, color: "#64748B", fontSize: 13, fontWeight: "500" },
  swapWrap: { alignItems: "flex-end", paddingRight: 20, height: 10, zIndex: 2 },
  swap: {
    marginTop: -16,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#0B192C",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  arrive: { flex: 1, minHeight: 60, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, justifyContent: "center" },
  arriveGhost: { backgroundColor: dark.card },
  arriveLater: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1.5, borderStyle: "dashed", borderColor: dark.borderStrong, backgroundColor: "transparent" },
  primary: { height: 56, borderRadius: 16, backgroundColor: dark.accent, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  lineCard: { borderRadius: 20, padding: 18 },
});
