import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Clock, DollarSign, Users, Check } from "lucide-react-native";
import { useTheme, spacing, radius, fonts, type as t, shadow } from "@/src/theme";
import { Card, StatusChip, Button, SectionHeader } from "@/src/components/ui";
import { ScreenHeader } from "@/src/components/primitives";
import { serviceById, BRANCHES } from "@/src/data/mock";

export default function ServiceDetail() {
  const { id, branchId } = useLocalSearchParams<{ id: string; branchId?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const svc = serviceById(id!);
  if (!svc) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <ScreenHeader testID="service-back-btn" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <View style={{ paddingHorizontal: 20 }}>
          <StatusChip label={svc.category} tone="info" />
          <Text style={[t.title1, { color: colors.onSurface, marginTop: 10 }]}>
            {svc.name}
          </Text>
          <Text style={[t.body, { color: colors.muted, marginTop: 8 }]}>{svc.description}</Text>
        </View>

        <SectionHeader title="Who is this for" />
        <View style={{ paddingHorizontal: 20 }}>
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Users size={18} color={colors.brandPrimary} />
              <Text style={{ color: colors.onSurface, flex: 1 }}>{svc.who}</Text>
            </View>
          </Card>
        </View>

        <SectionHeader title="What to bring" />
        <View style={{ paddingHorizontal: 20 }}>
          <Card>
            {svc.documents.map((d) => (
              <View key={d} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                <Check size={16} color={colors.brandPrimary} />
                <Text style={{ color: colors.onSurface, flex: 1 }}>{d}</Text>
              </View>
            ))}
          </Card>
        </View>

        <SectionHeader title="Details" />
        <View style={{ paddingHorizontal: 20, flexDirection: "row", gap: spacing.sm }}>
          <StatBox
            icon={<Clock size={16} color={colors.brandPrimary} />}
            label="Typical duration"
            value={`~${svc.typicalDurationMins} min`}
          />
          <StatBox icon={<DollarSign size={16} color={colors.brandPrimary} />} label="Fee" value={svc.fee ?? "N/A"} />
        </View>

        <SectionHeader title="Available at" />
        <View style={{ paddingHorizontal: 20, gap: spacing.sm }}>
          {BRANCHES.filter((b) => b.services.includes(svc.id))
            .slice(0, 3)
            .map((b) => (
              <Card key={b.id} onPress={() => router.push(`/branch/${b.id}`)}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View>
                    <Text style={{ color: colors.onSurface, fontWeight: "700", fontFamily: fonts.bold }}>{b.name}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                      {b.area} · {b.distanceKm} km
                    </Text>
                  </View>
                  <StatusChip label={`~${b.shortestWaitMins}m`} tone="info" />
                </View>
              </Card>
            ))}
        </View>

        <View style={{ padding: 20, marginTop: spacing.md, gap: spacing.sm }}>
          {svc.supportsQueue && (
            <Button
              testID="service-join-btn"
              label="Join a line"
              onPress={() => router.push(`/join/${svc.id}${branchId ? `?branchId=${branchId}` : ""}`)}
            />
          )}
          {svc.supportsSession && (
            <Button
              testID="service-sessions-btn"
              label="See scheduled sessions"
              variant="secondary"
              onPress={() => router.push("/(tabs)/sessions")}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatBox({ icon, label, value }: any) {
  const { colors } = useTheme();
  return (
    <View
      style={[{
        flex: 1,
        padding: spacing.md,
        borderRadius: radius.xl,
        backgroundColor: colors.surfaceSecondary,
      }, shadow.card]}
    >
      {icon}
      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>{label}</Text>
      <Text style={{ color: colors.onSurface, fontSize: 15, fontWeight: "700", fontFamily: fonts.bold, marginTop: 2 }}>
        {value}
      </Text>
    </View>
  );
}
