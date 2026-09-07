import { useRouter } from "expo-router";
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Bell,
  MapPin,
  Search as SearchIcon,
  SlidersHorizontal,
  ChevronDown,
  ArrowUpRight,
  BadgeCheck,
  Clock,
  ChevronRight,
} from "lucide-react-native";
import { useState } from "react";
import { useTheme, spacing, shadow, type as t, TAB_BAR_CLEARANCE } from "@/src/theme";
import { AGENCIES, BRANCHES, CURRENT_USER, AGENCY_BRANCHES } from "@/src/data/mock";
import { useAppStore } from "@/src/store/app-store";
import { Monogram } from "@/src/components/primitives";

const CHIPS = ["Open now", "All"] as const;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function Home() {
  const router = useRouter();
  const { colors } = useTheme();
  const [chip, setChip] = useState<(typeof CHIPS)[number]>("Open now");
  const hasActive = useAppStore((s) => !!s.activeTicketId);
  const ticket = useAppStore((s) => s.ticket);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE + 16 }}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Pressable testID="home-avatar" onPress={() => router.push("/(tabs)/account")} style={styles.avatar}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13, letterSpacing: 0.3 }}>{CURRENT_USER.initials}</Text>
            </Pressable>
            <Pressable testID="home-location-pill" style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <MapPin size={14} color={colors.muted} strokeWidth={2} />
              <Text style={[t.callout, { color: colors.onSurface, fontWeight: "600" }]}>{CURRENT_USER.area}</Text>
              <ChevronDown size={14} color={colors.muted} strokeWidth={2} />
            </Pressable>
          </View>
          <Pressable
            testID="home-notifications-btn"
            onPress={() => router.push("/notifications")}
            style={({ pressed }) => [styles.bell, shadow.card, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Bell size={19} color={colors.onSurface} strokeWidth={1.9} />
            <View style={styles.bellDot} />
          </Pressable>
        </View>

        {/* You're in line strip */}
        {hasActive && (
          <View style={{ paddingHorizontal: 20 }}>
            <Pressable
              testID="home-active-ticket-strip"
              onPress={() => router.push(`/ticket/${ticket.number}`)}
              style={({ pressed }) => [styles.strip, shadow.card, { opacity: pressed ? 0.92 : 1 }]}
            >
              <View style={styles.stripIcon}>
                <Clock size={20} color={colors.brandPrimary} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[t.headline, { color: colors.onSurface }]}>You're in line</Text>
                <Text style={[t.footnote, { color: colors.muted, marginTop: 2 }]} numberOfLines={1}>
                  {ticket.branch} · {ticket.ahead} ahead
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={styles.etaBadge}>
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 18, letterSpacing: -0.5 }}>{ticket.etaMins}</Text>
                </View>
                <Text style={[t.footnote, { color: colors.muted, fontWeight: "600" }]}>min</Text>
              </View>
            </Pressable>
          </View>
        )}

        {/* Display headline */}
        <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
          <Text style={[t.body, { color: colors.muted }]}>
            {greeting()}, {CURRENT_USER.name}.
          </Text>
          <Text style={[t.display, { color: colors.onSurface, marginTop: 6 }]}>What do you need{"\n"}to get done?</Text>
        </View>

        {/* Search */}
        <View style={{ paddingHorizontal: 20, marginTop: 22 }}>
          <View style={[styles.search, shadow.card]}>
            <SearchIcon size={18} color={colors.muted} strokeWidth={2} />
            <TextInput
              testID="home-search"
              placeholder="Search agencies & branches"
              placeholderTextColor={colors.muted}
              style={{ flex: 1, fontSize: 15, color: colors.onSurface, paddingVertical: 0 }}
              onFocus={() => router.push("/(tabs)/find")}
            />
            <Pressable testID="home-filter-btn" onPress={() => router.push("/(tabs)/find")} style={styles.filterBtn}>
              <SlidersHorizontal size={17} color="#fff" strokeWidth={2.2} />
            </Pressable>
          </View>
        </View>

        {/* Chips */}
        <View style={styles.chipRow}>
          {CHIPS.map((c) => {
            const active = chip === c;
            return (
              <Pressable
                key={c}
                testID={`home-chip-${c.toLowerCase().replace(/\s/g, "-")}`}
                onPress={() => setChip(c)}
                style={[
                  styles.chip,
                  active
                    ? { backgroundColor: colors.brand }
                    : { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.borderStrong },
                ]}
              >
                <Text style={{ color: active ? "#fff" : colors.muted, fontWeight: "600", fontSize: 13 }}>{c}</Text>
              </Pressable>
            );
          })}
          <View style={{ flex: 1 }} />
          <Pressable testID="home-sort-btn" hitSlop={8}>
            <Text style={{ color: colors.muted, fontWeight: "600", fontSize: 13 }}>Shortest first</Text>
          </Pressable>
        </View>

        {/* Your agencies */}
        <SectionRow title="Your agencies" testID="home-agencies-see-all" onAction={() => router.push("/(tabs)/find")} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={264 + 12}
          snapToAlignment="start"
          contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 6 }}
        >
          {AGENCIES.slice(0, 4).map((a, i) => (
            <AgencyCard key={a.id} agency={a} highlight={i === 0} />
          ))}
        </ScrollView>

        {/* Agencies near you */}
        <SectionRow title="Agencies near you" testID="home-near-see-all" onAction={() => router.push("/(tabs)/find")} />
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          {AGENCY_BRANCHES.slice(0, 3).map((ab) => {
            const a = AGENCIES.find((x) => x.id === ab.agencyId)!;
            return (
              <Pressable
                key={ab.id}
                testID={`home-near-${a.id}`}
                onPress={() => router.push(`/branch/${ab.branchId}`)}
                style={({ pressed }) => [styles.nearRow, shadow.card, { opacity: pressed ? 0.92 : 1 }]}
              >
                <Monogram code={a.code} bg={a.logoBg} fg={a.logoFg} size={44} radius={13} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Text numberOfLines={1} style={[t.headline, { color: colors.onSurface, flexShrink: 1 }]}>
                      {a.name}
                    </Text>
                    {a.verified && <BadgeCheck size={14} color="#fff" fill={colors.brandPrimary} />}
                  </View>
                  <Text style={[t.footnote, { color: colors.muted, marginTop: 2 }]} numberOfLines={1}>
                    {ab.name}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: colors.onSurface, fontWeight: "800", fontSize: 18, letterSpacing: -0.4 }}>
                    {ab.waitMins === 0 ? "Now" : `${ab.waitMins}m`}
                  </Text>
                  <Text style={[t.eyebrow, { color: colors.muted, fontSize: 9, marginTop: 2 }]}>shortest</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionRow({ title, testID, onAction }: { title: string; testID: string; onAction: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionRow}>
      <Text style={[t.title2, { color: colors.onSurface }]}>{title}</Text>
      <Pressable testID={testID} onPress={onAction} hitSlop={8} style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={{ color: colors.brandPrimary, fontWeight: "600", fontSize: 14 }}>See all</Text>
        <ChevronRight size={16} color={colors.brandPrimary} strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}

function AgencyCard({ agency, highlight }: { agency: (typeof AGENCIES)[number]; highlight?: boolean }) {
  const { colors } = useTheme();
  const router = useRouter();
  const fg = highlight ? "#FFFFFF" : colors.onSurface;
  const subFg = highlight ? "#9DB8F5" : colors.muted;

  return (
    <Pressable
      testID={`agency-card-${agency.id}`}
      onPress={() => router.push(`/branch/${BRANCHES[0].id}`)}
      style={({ pressed }) => [
        styles.agencyCard,
        highlight ? { backgroundColor: colors.brandPrimary } : [{ backgroundColor: colors.surfaceSecondary }, shadow.card],
        { opacity: pressed ? 0.92 : 1 },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Monogram code={agency.code} bg={highlight ? "#FFFFFF" : agency.logoBg} fg={highlight ? colors.brandPrimary : agency.logoFg} size={44} radius={13} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[t.headline, { color: fg }]}>
            {agency.name}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
            <Text style={[t.caption, { color: subFg }]}>{agency.city}</Text>
            <BadgeCheck size={12} color={highlight ? colors.brandPrimary : "#fff"} fill={highlight ? "#fff" : colors.brandPrimary} />
            <Text style={[t.caption, { color: subFg }]}>Verified</Text>
          </View>
        </View>
      </View>

      <Text style={[t.title2, { color: fg, marginTop: 22 }]} numberOfLines={1}>
        {agency.primaryBranch.split("·").pop()?.trim() || agency.primaryBranch}
      </Text>
      <Text style={[t.footnote, { color: subFg, marginTop: 4 }]}>
        {agency.waitMins}m wait · {agency.branchesCount} branches
      </Text>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 22 }}>
        <Text style={[t.footnote, { color: subFg, fontWeight: "500" }]}>{agency.inLine} in line now</Text>
        <Pressable
          testID={`agency-join-${agency.id}`}
          onPress={() => router.push(`/join/s1?branchId=${BRANCHES[0].id}`)}
          style={[styles.joinBtn, { backgroundColor: highlight ? "#FFFFFF" : colors.brand }]}
        >
          <Text style={{ color: highlight ? colors.brandPrimary : "#FFFFFF", fontWeight: "700", fontSize: 13 }}>Join</Text>
          <ArrowUpRight size={14} color={highlight ? colors.brandPrimary : "#FFFFFF"} strokeWidth={2.4} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 18,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#1D4ED8", alignItems: "center", justifyContent: "center" },
  bell: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  bellDot: { position: "absolute", top: 11, right: 12, width: 7, height: 7, borderRadius: 4, backgroundColor: "#E4572E", borderWidth: 1.5, borderColor: "#fff" },
  strip: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 12, paddingRight: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  stripIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: "#E1EFFE", alignItems: "center", justifyContent: "center" },
  etaBadge: { minWidth: 44, height: 40, borderRadius: 12, backgroundColor: "#0B192C", alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingLeft: 18,
    paddingRight: 6,
    height: 56,
    gap: 10,
  },
  filterBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#1D4ED8", alignItems: "center", justifyContent: "center" },
  chipRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, marginTop: 16, gap: 10 },
  chip: { height: 40, paddingHorizontal: 18, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 30,
    marginBottom: 12,
  },
  agencyCard: { width: 264, borderRadius: 24, padding: 16 },
  joinBtn: { paddingHorizontal: 16, height: 38, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 5 },
  nearRow: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 12, paddingRight: 16, flexDirection: "row", alignItems: "center", gap: 12 },
});
