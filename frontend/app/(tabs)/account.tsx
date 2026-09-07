import { useRouter } from "expo-router";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  User,
  Phone,
  Mail,
  MapPin,
  Bell,
  Accessibility,
  Type as TypeIcon,
  Shield,
  HelpCircle,
  LogOut,
  ChevronRight,
  Star,
} from "lucide-react-native";
import { useTheme, spacing, radius, fonts, shadow, type as t, TAB_BAR_CLEARANCE } from "@/src/theme";
import { Card } from "@/src/components/ui";
import { CURRENT_USER } from "@/src/data/mock";
import { setState } from "@/src/store/app-store";

export default function Account() {
  const router = useRouter();
  const { colors } = useTheme();

  const Row = ({ icon, label, sub, onPress, testID, danger }: any) => (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: danger ? "#FEE2E2" : colors.brandSecondary,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: danger ? "#B91C1C" : colors.onSurface, fontWeight: "600", fontFamily: fonts.semibold }}>
          {label}
        </Text>
        {sub && <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{sub}</Text>}
      </View>
      {!danger && <ChevronRight size={18} color={colors.muted} />}
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE + 16 }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 }}>
          <Text style={[t.title1, { color: colors.onSurface }]}>Account</Text>
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 30,
                  backgroundColor: colors.brandPrimary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: colors.onBrandPrimary, fontSize: 20, fontWeight: "800", letterSpacing: 0.5 }}>
                  {CURRENT_USER.initials}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[t.title3, { color: colors.onSurface }]}>
                  {CURRENT_USER.fullName}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <Phone size={12} color={colors.muted} />
                  <Text style={{ color: colors.muted, fontSize: 13 }}>{CURRENT_USER.phone}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Mail size={12} color={colors.muted} />
                  <Text style={{ color: colors.muted, fontSize: 13 }}>{CURRENT_USER.email}</Text>
                </View>
              </View>
            </View>
          </Card>
        </View>

        <SectionTitle title="Preferences" />
        <View style={[{ marginHorizontal: 20, backgroundColor: colors.surfaceSecondary, borderRadius: radius.xl, overflow: "hidden" }, shadow.card]}>
          <Row
            testID="acc-notifications"
            icon={<Bell size={18} color={colors.brandPrimary} />}
            label="Notifications"
            sub="Turn alerts, reminders, disruptions"
          />
          <View style={{ height: 1, backgroundColor: colors.divider, marginLeft: 60 }} />
          <Row
            testID="acc-saved-branches"
            icon={<MapPin size={18} color={colors.brandPrimary} />}
            label="Saved branches"
            sub="Half Way Tree · Constant Spring"
          />
          <View style={{ height: 1, backgroundColor: colors.divider, marginLeft: 60 }} />
          <Row
            testID="acc-accessibility"
            icon={<Accessibility size={18} color={colors.brandPrimary} />}
            label="Accessibility"
            sub="Larger text, reduced motion, staff assistance"
          />
          <View style={{ height: 1, backgroundColor: colors.divider, marginLeft: 60 }} />
          <Row
            testID="acc-language"
            icon={<TypeIcon size={18} color={colors.brandPrimary} />}
            label="Language & text size"
            sub="English · Default"
          />
        </View>

        <SectionTitle title="Privacy & Support" />
        <View style={[{ marginHorizontal: 20, backgroundColor: colors.surfaceSecondary, borderRadius: radius.xl, overflow: "hidden" }, shadow.card]}>
          <Row
            testID="acc-privacy"
            icon={<Shield size={18} color={colors.brandPrimary} />}
            label="Privacy & security"
            sub="Active devices, data controls"
          />
          <View style={{ height: 1, backgroundColor: colors.divider, marginLeft: 60 }} />
          <Row
            testID="acc-help"
            icon={<HelpCircle size={18} color={colors.brandPrimary} />}
            label="Help & support"
            onPress={() => router.push("/help")}
          />
          <View style={{ height: 1, backgroundColor: colors.divider, marginLeft: 60 }} />
          <Row
            testID="acc-feedback"
            icon={<Star size={18} color={colors.brandPrimary} />}
            label="Rate Lyne"
          />
        </View>

        <View style={[{ marginTop: spacing.lg, marginHorizontal: 20, backgroundColor: colors.surfaceSecondary, borderRadius: radius.xl, overflow: "hidden" }, shadow.card]}>
          <Row
            testID="acc-signout"
            icon={<LogOut size={18} color="#B91C1C" />}
            label="Sign out"
            danger
            onPress={() => {
              setState({ onboardingComplete: false, isAuthed: false });
              router.replace("/onboarding/welcome");
            }}
          />
        </View>

        <Text style={{ textAlign: "center", color: colors.muted, marginTop: spacing.lg, fontSize: 12 }}>
          Lyne v1.0 · Trusted by Tax Administration Jamaica
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ title }: { title: string }) {
  const { colors } = useTheme();
  return (
    <Text
      style={{
        color: colors.muted,
        fontSize: 12,
        fontWeight: "700",
        fontFamily: fonts.bold,
        textTransform: "uppercase",
        letterSpacing: 0.9,
        paddingHorizontal: 20,
        marginTop: spacing.lg,
        marginBottom: spacing.sm,
      }}
    >
      {title}
    </Text>
  );
}
