import { useRouter } from "expo-router";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Calendar, Users, MapPin, ChevronRight } from "lucide-react-native";
import { useTheme, type as t, TAB_BAR_CLEARANCE } from "@/src/theme";
import { Card, StatusChip, ProgressBar } from "@/src/components/ui";
import { SESSIONS } from "@/src/data/mock";

export default function Sessions() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
        <Text style={[t.title1, { color: colors.onSurface }]}>Sessions</Text>
        <Text style={[t.callout, { color: colors.muted, marginTop: 4 }]}>Reserve your place at capped scheduled events.</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: TAB_BAR_CLEARANCE + 16 }}>
        {SESSIONS.map((s) => {
          const pct = s.reservedCount / s.capacity;
          const almostFull = pct > 0.75;
          return (
            <Card key={s.id} testID={`session-${s.id}`} onPress={() => router.push(`/session/${s.id}`)}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" }}>
                  <Calendar size={22} color={colors.onBrandPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[t.title3, { color: colors.onSurface }]}>{s.title}</Text>
                  <Text style={[t.footnote, { color: colors.muted, marginTop: 4 }]}>
                    {s.date} · {s.timeRange}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                    <MapPin size={11} color={colors.muted} />
                    <Text style={[t.caption, { color: colors.muted }]}>{s.branchName}</Text>
                  </View>
                </View>
                <ChevronRight size={18} color={colors.muted} />
              </View>

              <View style={{ marginTop: 14 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Users size={12} color={colors.muted} />
                    <Text style={[t.caption, { color: colors.muted }]}>
                      {s.reservedCount} of {s.capacity} places reserved
                    </Text>
                  </View>
                  {almostFull && <StatusChip label="Almost full" tone="warning" />}
                </View>
                <ProgressBar value={pct} />
              </View>
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
