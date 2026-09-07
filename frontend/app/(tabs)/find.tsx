import { useRouter } from "expo-router";
import { useState } from "react";
import { View, Text, ScrollView, TextInput, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Search, SlidersHorizontal, ChevronDown, BadgeCheck, Bookmark, ArrowUpRight } from "lucide-react-native";
import { useTheme, shadow, type as t, TAB_BAR_CLEARANCE } from "@/src/theme";
import { AGENCIES, AGENCY_BRANCHES, AGENCY_CHIPS, QUICK_SEARCHES, CURRENT_USER } from "@/src/data/mock";
import { Monogram, Tag } from "@/src/components/primitives";
import { useAppStore, setState } from "@/src/store/app-store";

export default function Find() {
  const router = useRouter();
  const { colors } = useTheme();
  const [q, setQ] = useState("");
  const [chip, setChip] = useState<string | null>(null);
  const saved = useAppStore((s) => s.savedBranchIds);

  const list = AGENCY_BRANCHES.map((ab) => ({ ...ab, agency: AGENCIES.find((a) => a.id === ab.agencyId)! }))
    .filter((x) => {
      const hay = `${x.name} ${x.city} ${x.agency.name} ${x.agency.shortName}`.toLowerCase();
      if (q && !hay.includes(q.toLowerCase())) return false;
      if (chip && !hay.includes(chip.toLowerCase().split(" ")[0])) return false;
      return true;
    })
    .sort((a, b) => a.waitMins - b.waitMins);

  const toggleSave = (id: string) =>
    setState({ savedBranchIds: saved.includes(id) ? saved.filter((x) => x !== id) : [...saved, id] });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE + 16 }}
        stickyHeaderIndices={[0]}
      >
        {/* Search (sticky) */}
        <View style={{ backgroundColor: colors.surface, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 }}>
          <View style={[styles.search, shadow.card]}>
            <Search size={18} color={colors.muted} strokeWidth={2} />
            <TextInput
              testID="find-search"
              value={q}
              onChangeText={setQ}
              placeholder="Search agencies & branches"
              placeholderTextColor={colors.muted}
              autoCorrect={false}
              returnKeyType="search"
              style={{ flex: 1, fontSize: 15, color: colors.onSurface, paddingVertical: 0 }}
            />
            <Pressable testID="find-avatar" onPress={() => router.push("/(tabs)/account")} style={styles.avatar}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>{CURRENT_USER.initials}</Text>
            </Pressable>
          </View>
        </View>

        {/* Filters row */}
        <View style={styles.filtersRow}>
          <Pressable testID="find-filters-btn" hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <SlidersHorizontal size={16} color={colors.onSurface} strokeWidth={2} />
            <Text style={[t.callout, { color: colors.onSurface, fontWeight: "600" }]}>Filters</Text>
            <ChevronDown size={14} color={colors.muted} strokeWidth={2} />
          </Pressable>
          <Pressable testID="find-sort-btn" hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={[t.callout, { color: colors.onSurface, fontWeight: "600" }]}>Shortest wait</Text>
            <ChevronDown size={14} color={colors.muted} strokeWidth={2} />
          </Pressable>
        </View>

        {/* Agency chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 4 }}>
          {AGENCY_CHIPS.map((c) => {
            const active = chip === c;
            return (
              <Pressable
                key={c}
                testID={`filter-${c.replace(/\s/g, "-").toLowerCase()}`}
                onPress={() => setChip(active ? null : c)}
                style={[styles.chip, active ? { backgroundColor: colors.brand } : { backgroundColor: "#FFFFFF" }]}
              >
                <Text style={{ color: active ? "#fff" : colors.onSurface, fontWeight: "600", fontSize: 13 }}>{c}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Try one of these */}
        {!q && (
          <View style={{ paddingHorizontal: 20, marginTop: 22 }}>
            <Text style={[t.title3, { color: colors.onSurface, marginBottom: 12 }]}>Try one of these</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {QUICK_SEARCHES.map((s) => (
                <Pressable
                  key={s}
                  testID={`quick-${s.replace(/\s/g, "-").toLowerCase()}`}
                  onPress={() => setQ(s.split(" ")[0])}
                  style={[styles.quick, shadow.card]}
                >
                  <Search size={14} color={colors.onSurface} strokeWidth={2.2} />
                  <Text style={{ color: colors.onSurface, fontWeight: "600", fontSize: 14 }}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Agency list */}
        <View style={{ paddingHorizontal: 20, marginTop: 26 }}>
          <Text style={[t.title3, { color: colors.onSurface, marginBottom: 12 }]}>
            {q || chip ? `${list.length} result${list.length === 1 ? "" : "s"}` : "Every agency on Lyne"}
          </Text>
          {list.length === 0 && (
            <View style={{ paddingVertical: 40, alignItems: "center" }}>
              <Text style={[t.body, { color: colors.muted }]}>No agencies match your search.</Text>
            </View>
          )}
          <View style={{ gap: 12 }}>
            {list.map((x) => {
              const isSaved = saved.includes(x.branchId);
              return (
                <Pressable
                  key={x.id}
                  testID={`branch-${x.branchId}`}
                  onPress={() => router.push(`/branch/${x.branchId}`)}
                  style={({ pressed }) => [styles.card, shadow.card, { opacity: pressed ? 0.94 : 1 }]}
                >
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                    <Monogram code={x.agency.code} bg={x.agency.logoBg} fg={x.agency.logoFg} size={46} radius={14} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Text numberOfLines={1} style={[t.footnote, { color: colors.muted, fontWeight: "500", flexShrink: 1 }]}>
                          {x.agency.name}
                        </Text>
                        <BadgeCheck size={13} color="#fff" fill={colors.brandPrimary} />
                      </View>
                      <Text style={[t.title3, { color: colors.onSurface, marginTop: 2 }]} numberOfLines={1}>
                        {x.name}
                      </Text>
                    </View>
                    <Pressable testID={`save-${x.branchId}`} onPress={() => toggleSave(x.branchId)} hitSlop={10} style={{ padding: 2 }}>
                      <Bookmark size={20} color={isSaved ? colors.brandPrimary : "#94A3B8"} fill={isSaved ? colors.brandPrimary : "transparent"} strokeWidth={1.8} />
                    </Pressable>
                  </View>

                  <View style={{ flexDirection: "row", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
                    <Tag label={x.city} />
                    <Tag label={`${x.openLines} open`} />
                    <Tag label={`Open until ${x.closesAt}`} />
                  </View>

                  <View style={styles.divider} />

                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ color: colors.onSurface, fontSize: 15 }}>
                      <Text style={{ fontWeight: "800", letterSpacing: -0.3 }}>{x.waitMins === 0 ? "Now" : `${x.waitMins}m`}</Text>
                      <Text style={{ color: colors.muted }}> · {x.inLine} in line</Text>
                    </Text>
                    <Pressable
                      testID={`join-${x.branchId}`}
                      onPress={() => router.push(`/join/${x.serviceId}?branchId=${x.branchId}`)}
                      style={({ pressed }) => [styles.joinBtn, { opacity: pressed ? 0.8 : 1 }]}
                    >
                      <Text style={{ color: colors.brandPrimary, fontWeight: "700", fontSize: 14 }}>Join</Text>
                      <ArrowUpRight size={15} color={colors.brandPrimary} strokeWidth={2.4} />
                    </Pressable>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#1D4ED8", alignItems: "center", justifyContent: "center" },
  filtersRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  chip: { height: 40, paddingHorizontal: 16, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  quick: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFFFFF", borderRadius: 999, height: 44, paddingHorizontal: 16 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 16 },
  divider: { height: 1, backgroundColor: "#EEF2F7", marginVertical: 14 },
  joinBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#E1EFFE", height: 40, paddingHorizontal: 16, borderRadius: 14 },
});
