import { useRouter } from "expo-router";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bell, AlertTriangle, CheckCircle2 } from "lucide-react-native";
import { useTheme, spacing, type as t } from "@/src/theme";
import { Card } from "@/src/components/ui";
import { ScreenHeader } from "@/src/components/primitives";
import { NOTIFICATIONS } from "@/src/data/mock";

export default function Notifications() {
  const router = useRouter();
  const { colors } = useTheme();
  const today = NOTIFICATIONS.filter((n) => n.group === "today");
  const earlier = NOTIFICATIONS.filter((n) => n.group === "earlier");

  const iconFor = (k: string) => {
    if (k === "urgent") return <AlertTriangle size={16} color="#B91C1C" />;
    if (k === "success") return <CheckCircle2 size={16} color="#166534" />;
    return <Bell size={16} color={colors.brandPrimary} />;
  };

  const bgFor = (k: string) => {
    if (k === "urgent") return "#FEE2E2";
    if (k === "success") return "#DCFCE7";
    return colors.brandSecondary;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <ScreenHeader testID="notif-back-btn" title="Notifications" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl, paddingTop: 8 }}>
        {[
          { title: "Today", items: today },
          { title: "Earlier", items: earlier },
        ].map((g) => (
          <View key={g.title} style={{ marginBottom: spacing.md }}>
            <Text style={[t.eyebrow, { color: colors.muted, paddingHorizontal: 20, marginBottom: 10 }]}>
              {g.title}
            </Text>
            <View style={{ paddingHorizontal: 20, gap: 10 }}>
              {g.items.map((n) => (
                <Card
                  key={n.id}
                  testID={`notif-${n.id}`}
                  onPress={() => n.ticketId && router.push(`/ticket/${n.ticketId}`)}
                >
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        backgroundColor: bgFor(n.kind),
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {iconFor(n.kind)}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text style={[t.headline, { color: colors.onSurface, flex: 1, fontWeight: n.read ? "600" : "700" }]}>
                          {n.title}
                        </Text>
                        <Text style={[t.caption, { color: colors.muted }]}>{n.when}</Text>
                      </View>
                      <Text style={[t.footnote, { color: colors.muted, marginTop: 3 }]}>{n.body}</Text>
                    </View>
                    {!n.read && (
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brandPrimary, marginTop: 6 }} />
                    )}
                  </View>
                </Card>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
