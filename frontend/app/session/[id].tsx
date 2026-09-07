import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Calendar, Clock, MapPin, Users, Check, Accessibility } from "lucide-react-native";
import { useTheme, spacing, fonts, type as t } from "@/src/theme";
import { Card, StatusChip, Button, ProgressBar, SectionHeader } from "@/src/components/ui";
import { ScreenHeader } from "@/src/components/primitives";
import { sessionById, RESERVATIONS } from "@/src/data/mock";

export default function SessionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const s = sessionById(id!);
  if (!s) return null;
  const pct = s.reservedCount / s.capacity;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <ScreenHeader testID="session-back-btn" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={{ paddingHorizontal: 20 }}>
          <StatusChip label="Scheduled session" tone="info" icon={<Calendar size={12} color={colors.onBrandSecondary} />} />
          <Text style={[t.title1, { color: colors.onSurface, marginTop: 10 }]}>
            {s.title}
          </Text>

          <Card style={{ marginTop: spacing.md }}>
            <Row icon={<Calendar size={16} color={colors.brandPrimary} />} label={s.date} />
            <Row icon={<Clock size={16} color={colors.brandPrimary} />} label={s.timeRange} />
            <Row icon={<MapPin size={16} color={colors.brandPrimary} />} label={s.branchName} />
            <Row icon={<Accessibility size={16} color={colors.brandPrimary} />} label="Wheelchair accessible" />
          </Card>

          <Card style={{ marginTop: spacing.md }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Users size={14} color={colors.muted} />
                <Text style={{ color: colors.muted, fontSize: 13 }}>
                  {s.reservedCount} of {s.capacity} places reserved
                </Text>
              </View>
              <Text style={{ color: colors.brandPrimary, fontWeight: "700", fontSize: 13 }}>
                {s.capacity - s.reservedCount} left
              </Text>
            </View>
            <ProgressBar value={pct} />
          </Card>
        </View>

        <SectionHeader title="Who can reserve" />
        <View style={{ paddingHorizontal: 20 }}>
          <Card>
            <Text style={{ color: colors.onSurface }}>{s.eligibility}</Text>
          </Card>
        </View>

        <SectionHeader title="What to bring" />
        <View style={{ paddingHorizontal: 20 }}>
          <Card>
            {s.documents.map((d) => (
              <View key={d} style={{ flexDirection: "row", gap: 10, marginBottom: 8 }}>
                <Check size={16} color={colors.brandPrimary} />
                <Text style={{ color: colors.onSurface, flex: 1 }}>{d}</Text>
              </View>
            ))}
          </Card>
        </View>

        <SectionHeader title="Arrival tip" />
        <View style={{ paddingHorizontal: 20 }}>
          <Card style={{ backgroundColor: colors.surfaceTertiary }}>
            <Text style={{ color: colors.brandPrimary, fontWeight: "700", fontFamily: fonts.bold }}>
              Arrive {s.recommendedArrival}
            </Text>
            <Text style={{ color: colors.onSurface, marginTop: 4, fontSize: 13 }}>
              We'll send you a reminder before it's time to leave.
            </Text>
          </Card>
        </View>
      </ScrollView>

      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: 20,
          backgroundColor: colors.surface,
        }}
      >
        <Button
          testID="session-reserve-btn"
          label="Reserve my place"
          onPress={() => router.replace(`/reservation/${RESERVATIONS[0].id}`)}
        />
      </View>
    </SafeAreaView>
  );
}

function Row({ icon, label }: any) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}>
      {icon}
      <Text style={{ color: colors.onSurface, flex: 1 }}>{label}</Text>
    </View>
  );
}
