import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, ScrollView, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Clock, MapPin, Accessibility, Phone, Navigation, AlertTriangle } from "lucide-react-native";
import { useTheme, spacing, radius, type as t } from "@/src/theme";
import { Card, StatusChip, Button, SectionHeader } from "@/src/components/ui";
import { ScreenHeader } from "@/src/components/primitives";
import { branchById, SERVICES } from "@/src/data/mock";

export default function BranchDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const branch = branchById(id!);

  if (!branch) return null;
  const services = SERVICES.filter((s) => branch.services.includes(s.id));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <ScreenHeader testID="branch-back-btn" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <View
          style={{
            marginHorizontal: 20,
            height: 160,
            borderRadius: radius.xxl,
            overflow: "hidden",
            backgroundColor: colors.brand,
          }}
        >
          <Image source={{ uri: branch.image }} style={{ width: "100%", height: "100%" }} />
        </View>

        <View style={{ padding: 20 }}>
          <Text style={[t.title1, { color: colors.onSurface }]}>
            {branch.name}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
            <MapPin size={12} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 13 }}>{branch.address}</Text>
          </View>

          <View style={{ flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {branch.status === "open" && <StatusChip label="Open now" tone="success" />}
            {branch.status === "closing_soon" && (
              <StatusChip label="Closing soon" tone="warning" icon={<AlertTriangle size={12} color="#B91C1C" />} />
            )}
            {branch.status === "closed" && <StatusChip label="Closed" tone="neutral" />}
            <StatusChip label={branch.hoursToday} tone="info" icon={<Clock size={12} color={colors.onBrandSecondary} />} />
            {branch.accessible && (
              <StatusChip label="Accessible" tone="neutral" icon={<Accessibility size={12} color={colors.muted} />} />
            )}
          </View>

          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Button
                testID="branch-directions-btn"
                label="Directions"
                variant="secondary"
                icon={<Navigation size={16} color={colors.brandPrimary} />}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                testID="branch-call-btn"
                label="Call"
                variant="secondary"
                icon={<Phone size={16} color={colors.brandPrimary} />}
              />
            </View>
          </View>

          {branch.notice && (
            <View style={{ marginTop: spacing.md }}>
              <Card style={{ backgroundColor: "#FEF3C7", borderColor: "#FDE68A" }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <AlertTriangle size={16} color="#B45309" />
                  <Text style={{ color: "#78350F", fontSize: 13, flex: 1 }}>{branch.notice}</Text>
                </View>
              </Card>
            </View>
          )}
        </View>

        <SectionHeader title="Available services" />
        <View style={{ paddingHorizontal: 20, gap: spacing.sm }}>
          {services.map((s) => (
            <Card
              key={s.id}
              testID={`branch-service-${s.id}`}
              onPress={() => router.push(`/service/${s.id}?branchId=${branch.id}`)}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flex: 1 }}>
                  <Text style={[t.headline, { color: colors.onSurface }]}>{s.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                    Typical ~{s.typicalDurationMins} min · {s.category}
                  </Text>
                </View>
                <StatusChip
                  label={`~${Math.max(10, s.typicalDurationMins + 5)}m`}
                  tone="info"
                  icon={<Clock size={12} color={colors.onBrandSecondary} />}
                />
              </View>
            </Card>
          ))}
        </View>

        <View style={{ padding: 20, marginTop: spacing.md }}>
          <Button
            testID="branch-join-line-btn"
            label={branch.virtualJoining && branch.status === "open" ? "Join a line" : "Virtual joining unavailable"}
            disabled={!branch.virtualJoining || branch.status === "closed"}
            onPress={() => router.push(`/join/${services[0]?.id}?branchId=${branch.id}`)}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
