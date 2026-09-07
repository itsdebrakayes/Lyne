import { useRouter } from "expo-router";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronRight, AlertTriangle, Phone } from "lucide-react-native";
import { useTheme, spacing, type as t } from "@/src/theme";
import { Card, SectionHeader } from "@/src/components/ui";
import { ScreenHeader } from "@/src/components/primitives";

const FAQS = [
  { q: "How virtual lines work", a: "Join from anywhere — we hold your place while you go about your day." },
  { q: "What happens if I miss my turn?", a: "You'll be requeued or marked no-show; a fresh ticket can be created." },
  { q: "How do I check in?", a: "Tap 'I've arrived', scan the branch QR, or enter the kiosk code." },
  { q: "Where can I find my verification code?", a: "It's on your Live Ticket screen — show it to the officer at your counter." },
];

export default function Help() {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <ScreenHeader testID="help-back-btn" title="Help & support" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <SectionHeader title="Frequently asked" />
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          {FAQS.map((f, i) => (
            <Card key={i}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[t.headline, { color: colors.onSurface }]}>{f.q}</Text>
                  <Text style={[t.footnote, { color: colors.muted, marginTop: 4 }]}>{f.a}</Text>
                </View>
                <ChevronRight size={18} color={colors.muted} />
              </View>
            </Card>
          ))}
        </View>

        <SectionHeader title="Contact" />
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          <Card>
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: colors.brandSecondary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Phone size={18} color={colors.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.onSurface, fontWeight: "700" }}>Contact Lyne support</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>1-888-TAX-HELP</Text>
              </View>
            </View>
          </Card>
          <Card>
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: "#FEE2E2",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <AlertTriangle size={18} color="#B91C1C" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.onSurface, fontWeight: "700" }}>Report a technical issue</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>We'll investigate right away</Text>
              </View>
            </View>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
