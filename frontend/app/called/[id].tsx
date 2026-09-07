import { useEffect, useState, useRef } from "react";
import { useRouter } from "expo-router";
import { View, Text, Animated, StyleSheet, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ShieldCheck, XCircle, Accessibility, Navigation } from "lucide-react-native";
import { dark, type as t } from "@/src/theme";
import { Button } from "@/src/components/ui";
import { ScreenHeader } from "@/src/components/primitives";
import { useAppStore, setState } from "@/src/store/app-store";

export default function Called() {
  const router = useRouter();
  const ticket = useAppStore((s) => s.ticket);
  const [seconds, setSeconds] = useState(300);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.04, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    ).start();
    return () => clearInterval(id);
  }, [pulse]);

  const mm = Math.floor(seconds / 60);
  const ss = (seconds % 60).toString().padStart(2, "0");
  const urgent = seconds < 60;
  const window = `${ticket.number.split("-")[0]}-3`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: dark.bg }} edges={["top"]}>
      <StatusBar barStyle="light-content" />
      <ScreenHeader testID="called-back-btn" tone="dark" title="It's your turn" onBack={() => router.back()} />

      <View style={{ flex: 1, paddingHorizontal: 20, justifyContent: "center" }}>
        <Animated.View style={[styles.hero, { backgroundColor: urgent ? "#B91C1C" : dark.accent, transform: [{ scale: pulse }] }]}>
          <Text style={[t.eyebrow, { color: "#C7D7FB" }]}>Go to</Text>
          <Text style={{ color: "#fff", fontSize: 30, fontWeight: "700", letterSpacing: -0.6, marginTop: 8 }}>Window</Text>
          <Text testID="called-window-display" style={{ color: "#fff", fontSize: 76, fontWeight: "800", letterSpacing: -2.5, lineHeight: 84 }}>
            {window}
          </Text>
          <Text style={[t.callout, { color: "#C7D7FB", marginTop: 6 }]}>Ground floor · {ticket.branch}</Text>

          <View style={styles.timer}>
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>Respond within</Text>
            <Text testID="called-countdown" style={{ color: "#fff", fontSize: 28, fontWeight: "800", letterSpacing: -0.5 }}>
              {mm}:{ss}
            </Text>
          </View>
        </Animated.View>

        <View style={styles.code}>
          <ShieldCheck size={18} color="#9DB8F5" />
          <Text style={{ color: dark.muted, fontWeight: "600" }}>Code</Text>
          <Text style={{ color: dark.text, fontSize: 20, fontWeight: "800", letterSpacing: 4 }}>{ticket.code}</Text>
        </View>
      </View>

      <View style={{ padding: 20, gap: 10 }}>
        <Button
          testID="called-on-my-way-btn"
          label="I'm on my way"
          onPress={() => {
            setState({ activeTicketStage: "in_service" });
            router.replace(`/feedback/${ticket.number}`);
          }}
          icon={<Navigation size={16} color="#fff" />}
        />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button testID="called-assistance-btn" label="I need help" variant="secondary" icon={<Accessibility size={16} color="#1D4ED8" />} />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              testID="called-cant-make-it-btn"
              label="Can't make it"
              variant="destructive"
              icon={<XCircle size={16} color="#fff" />}
              onPress={() => {
                setState({ activeTicketId: null, activeTicketStage: "cancelled" });
                router.replace("/(tabs)/home");
              }}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 28, padding: 24, alignItems: "center" },
  timer: {
    marginTop: 22,
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  code: {
    marginTop: 14,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: dark.card,
    borderWidth: 1,
    borderColor: dark.border,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 16,
  },
});
