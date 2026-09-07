import { useState } from "react";
import { useRouter } from "expo-router";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Clock, ChevronRight, Ticket as TicketIcon, Calendar, CheckCircle2, ArrowUpRight } from "lucide-react-native";
import { useTheme, shadow, type as t, TAB_BAR_CLEARANCE } from "@/src/theme";
import { Card, EmptyState } from "@/src/components/ui";
import { PAST_VISITS, RESERVATIONS } from "@/src/data/mock";
import { useAppStore } from "@/src/store/app-store";

const TABS = ["Active", "Upcoming", "Past"] as const;

export default function Visits() {
  const router = useRouter();
  const { colors } = useTheme();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Active");
  const hasActive = useAppStore((s) => !!s.activeTicketId);
  const ticket = useAppStore((s) => s.ticket);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
        <Text style={[t.title1, { color: colors.onSurface }]}>My Visits</Text>
        <Text style={[t.callout, { color: colors.muted, marginTop: 4 }]}>Lines you're in, sessions you've booked and where you've been.</Text>
      </View>

      {/* Segmented control */}
      <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
        <View style={styles.segment}>
          {TABS.map((x) => {
            const active = tab === x;
            return (
              <Pressable key={x} testID={`visits-tab-${x.toLowerCase()}`} onPress={() => setTab(x)} style={[styles.segmentItem, active && [styles.segmentActive, shadow.card]]}>
                <Text style={{ color: active ? colors.onSurface : colors.muted, fontWeight: "600", fontSize: 14 }}>{x}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: TAB_BAR_CLEARANCE + 16 }}>
        {tab === "Active" &&
          (hasActive ? (
            <Pressable
              testID="visit-active-item"
              onPress={() => router.push(`/ticket/${ticket.number}`)}
              style={({ pressed }) => [styles.activeCard, { opacity: pressed ? 0.92 : 1 }]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={styles.livePill}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#22C55E" }} />
                  <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>In line</Text>
                </View>
                <Text style={{ color: "#9DB8F5", fontWeight: "700", fontSize: 13 }}>{ticket.agencyCode}</Text>
              </View>
              <Text style={{ color: "#fff", fontSize: 40, fontWeight: "800", letterSpacing: -1.2, marginTop: 14 }}>{ticket.number}</Text>
              <Text style={[t.headline, { color: "#fff", marginTop: 2 }]}>{ticket.service}</Text>
              <Text style={[t.footnote, { color: "#9DB8F5", marginTop: 2 }]}>{ticket.branch}</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Clock size={14} color="#9DB8F5" />
                  <Text style={{ color: "#9DB8F5", fontWeight: "500" }}>
                    {ticket.ahead} ahead · ~{ticket.etaMins}m
                  </Text>
                </View>
                <View style={styles.openBtn}>
                  <Text style={{ color: "#0B192C", fontWeight: "700", fontSize: 13 }}>Open</Text>
                  <ArrowUpRight size={14} color="#0B192C" strokeWidth={2.4} />
                </View>
              </View>
            </Pressable>
          ) : (
            <EmptyState
              title="You're not in a line"
              body="Join a line or reserve a session to get started."
              icon={<TicketIcon size={40} color={colors.muted} />}
              action="Find a branch"
              onAction={() => router.push("/(tabs)/find")}
            />
          ))}

        {tab === "Upcoming" &&
          (RESERVATIONS.length > 0 ? (
            RESERVATIONS.map((r) => (
              <Card key={r.id} testID={`upcoming-${r.id}`} onPress={() => router.push(`/reservation/${r.id}`)}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={[styles.icon, { backgroundColor: colors.brandSecondary }]}>
                    <Calendar size={22} color={colors.brandPrimary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[t.headline, { color: colors.onSurface }]}>{r.sessionTitle}</Text>
                    <Text style={[t.footnote, { color: colors.muted, marginTop: 2 }]}>
                      {r.date} · {r.timeRange}
                    </Text>
                    <Text style={{ color: colors.brandPrimary, fontSize: 12, marginTop: 4, fontWeight: "700", letterSpacing: 0.5 }}>{r.accessCode}</Text>
                  </View>
                  <ChevronRight size={18} color={colors.muted} />
                </View>
              </Card>
            ))
          ) : (
            <EmptyState title="No upcoming sessions" body="Reserve one from a branch page." icon={<Calendar size={40} color={colors.muted} />} />
          ))}

        {tab === "Past" &&
          (PAST_VISITS.length > 0 ? (
            PAST_VISITS.map((v) => (
              <Card key={v.id} testID={`past-${v.id}`} onPress={() => router.push(`/feedback/${v.id}`)}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={[styles.icon, { backgroundColor: "#DCFCE7" }]}>
                    <CheckCircle2 size={22} color="#166534" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[t.headline, { color: colors.onSurface }]}>
                      {v.number} · {v.serviceName}
                    </Text>
                    <Text style={[t.footnote, { color: colors.muted, marginTop: 2 }]}>
                      {v.branchName} · {v.joinedAt}
                    </Text>
                  </View>
                  <Text style={{ color: "#166534", fontSize: 12, fontWeight: "700" }}>Completed</Text>
                </View>
              </Card>
            ))
          ) : (
            <EmptyState title="No past visits yet" body="Your completed visits will appear here." icon={<TicketIcon size={40} color={colors.muted} />} />
          ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: "row", backgroundColor: "#E6EAF0", borderRadius: 16, padding: 4 },
  segmentItem: { flex: 1, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  segmentActive: { backgroundColor: "#FFFFFF" },
  activeCard: { backgroundColor: "#0B192C", borderRadius: 24, padding: 20 },
  livePill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.10)", paddingHorizontal: 10, height: 28, borderRadius: 14 },
  openBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#fff", height: 36, paddingHorizontal: 14, borderRadius: 999 },
  icon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
});
