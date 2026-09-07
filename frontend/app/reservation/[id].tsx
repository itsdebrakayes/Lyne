import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CheckCircle2, Calendar, MapPin, QrCode, X, Bell } from "lucide-react-native";
import { useTheme, spacing, radius, type as t } from "@/src/theme";
import { Card, Button } from "@/src/components/ui";
import { CircleButton } from "@/src/components/primitives";
import { reservationById } from "@/src/data/mock";

export default function ReservationConfirm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const r = reservationById(id!);
  if (!r) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <View style={{ flexDirection: "row", paddingHorizontal: 20, height: 60, alignItems: "center", justifyContent: "flex-end" }}>
        <CircleButton testID="reservation-close-btn" onPress={() => router.replace("/(tabs)/home")}>
          <X size={20} color={colors.onSurface} strokeWidth={2.2} />
        </CircleButton>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <View style={{ alignItems: "center", paddingHorizontal: 20 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: "#DCFCE7",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CheckCircle2 size={40} color="#166534" strokeWidth={2} />
          </View>
          <Text style={[t.title1, { color: colors.onSurface, marginTop: spacing.md, textAlign: "center" }]}>
            You're reserved
          </Text>
          <Text style={[t.body, { color: colors.muted, textAlign: "center", marginTop: 6 }]}>
            {r.sessionTitle}
          </Text>
        </View>

        <View style={{ padding: 20 }}>
          <Card style={{ backgroundColor: colors.brand, alignItems: "center", borderRadius: radius.xxl, padding: 24 }}>
            <Text style={[t.eyebrow, { color: "#9DB8F5" }]}>Access code</Text>
            <Text
              testID="reservation-access-code"
              style={{
                color: colors.onBrand,
                fontSize: 36,
                fontWeight: "800",
                letterSpacing: 4,
                marginTop: 8,
              }}
            >
              {r.accessCode}
            </Text>

            {/* Fake QR block */}
            <View
              style={{
                width: 160,
                height: 160,
                backgroundColor: "#fff",
                borderRadius: radius.md,
                marginTop: spacing.md,
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
              }}
            >
              <QrCode size={128} color={colors.brand} strokeWidth={1.2} />
            </View>

            <Text style={{ color: "#9DB8F5", fontSize: 12, marginTop: spacing.md }}>Ref: {r.reference}</Text>
          </Card>
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          <Card>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              <Calendar size={16} color={colors.brandPrimary} />
              <Text style={{ color: colors.onSurface }}>
                {r.date} · {r.timeRange}
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center", marginTop: 8 }}>
              <MapPin size={16} color={colors.brandPrimary} />
              <Text style={{ color: colors.onSurface }}>{r.branchName}</Text>
            </View>
          </Card>
        </View>

        <View style={{ padding: 20, gap: spacing.sm }}>
          <Button
            testID="reservation-directions-btn"
            label="Add to calendar"
            variant="secondary"
            icon={<Calendar size={16} color={colors.brandPrimary} />}
          />
          <Button
            testID="reservation-remind-btn"
            label="Set reminder"
            variant="tertiary"
            icon={<Bell size={16} color={colors.brandPrimary} />}
          />
          <Button
            testID="reservation-done-btn"
            label="Done"
            onPress={() => router.replace("/(tabs)/home")}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
