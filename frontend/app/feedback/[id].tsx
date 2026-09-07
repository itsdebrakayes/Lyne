import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, ScrollView, Pressable, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CheckCircle2, X, Star, RotateCcw, AlertTriangle } from "lucide-react-native";
import { useTheme, spacing, radius, type as t } from "@/src/theme";
import { Card, Button, SectionHeader } from "@/src/components/ui";
import { CircleButton } from "@/src/components/primitives";
import { ACTIVE_TICKET, PAST_VISITS } from "@/src/data/mock";

export default function Feedback() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const ticket = PAST_VISITS.find((p) => p.id === id) ?? ACTIVE_TICKET;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <View style={{ flexDirection: "row", paddingHorizontal: 20, height: 60, alignItems: "center", justifyContent: "flex-end" }}>
        <CircleButton testID="feedback-close-btn" onPress={() => router.replace("/(tabs)/home")}>
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
            <CheckCircle2 size={40} color="#166534" />
          </View>
          <Text style={[t.title1, { color: colors.onSurface, marginTop: spacing.md }]}>
            Visit completed
          </Text>
          <Text style={[t.body, { color: colors.muted, marginTop: 6, textAlign: "center" }]}>
            Thanks for using Lyne. We hope your visit went well.
          </Text>
        </View>

        <View style={{ padding: 20 }}>
          <Card>
            <Text style={[t.eyebrow, { color: colors.muted }]}>Ticket</Text>
            <Text style={[t.title2, { color: colors.onSurface, marginTop: 6 }]}>
              {ticket.number}
            </Text>
            <Text style={{ color: colors.onSurface, marginTop: 4 }}>{ticket.serviceName}</Text>
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>
              {ticket.branchName} · {ticket.joinedAt}
            </Text>
          </Card>
        </View>

        <SectionHeader title="How was your visit?" />
        <View style={{ paddingHorizontal: 20 }}>
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable
                  key={n}
                  testID={`feedback-star-${n}`}
                  onPress={() => setRating(n)}
                  style={{ padding: 8 }}
                >
                  <Star size={36} color={n <= rating ? "#F59E0B" : colors.borderStrong} fill={n <= rating ? "#F59E0B" : "transparent"} />
                </Pressable>
              ))}
            </View>
            <TextInput
              testID="feedback-text"
              value={feedback}
              onChangeText={setFeedback}
              placeholder="Any additional feedback? (optional)"
              placeholderTextColor={colors.muted}
              multiline
              style={{
                marginTop: 12,
                backgroundColor: colors.surfaceTertiary,
                borderRadius: radius.md,
                padding: 12,
                color: colors.onSurface,
                minHeight: 80,
                textAlignVertical: "top",
              }}
            />
          </Card>
        </View>

        <View style={{ padding: 20, gap: spacing.sm }}>
          <Button testID="feedback-submit-btn" label="Submit feedback" onPress={() => router.replace("/(tabs)/home")} />
          <Button
            testID="feedback-repeat-btn"
            label="Use this service again"
            variant="secondary"
            icon={<RotateCcw size={16} color={colors.brandPrimary} />}
          />
          <Button
            testID="feedback-report-btn"
            label="Report a problem"
            variant="tertiary"
            icon={<AlertTriangle size={16} color="#B91C1C" />}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
