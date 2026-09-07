import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { View, Text, ScrollView, Pressable, Animated, StyleSheet, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bell, BellRing, Check, Footprints, MapPin } from "lucide-react-native";
import { dark, type as t } from "@/src/theme";
import { ScreenHeader } from "@/src/components/primitives";
import { Barcode } from "@/src/components/barcode";
import { LeaveLineSheet } from "@/src/components/leave-line-sheet";
import { useAppStore, setState } from "@/src/store/app-store";

const NAVY = "#0B192C";
const MUTED = "#64748B";

export default function LiveTicket() {
  const router = useRouter();
  const ticket = useAppStore((s) => s.ticket);
  const stage = useAppStore((s) => s.activeTicketStage);
  const ahead = useAppStore((s) => s.peopleAhead);
  const eta = useAppStore((s) => s.etaMins);
  const [alerts, setAlerts] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const statusLabel =
    stage === "almost_up" ? "Almost up" : stage === "checked_in" ? "Checked in" : stage === "called" ? "Called" : "Waiting";

  const advance = () => {
    if (stage === "joined") setState({ activeTicketStage: "almost_up", peopleAhead: Math.min(ahead, 1), etaMins: Math.min(eta, 5) });
    else if (stage === "almost_up") setState({ activeTicketStage: "checked_in", peopleAhead: 0, etaMins: 2 });
    else router.push(`/called/${ticket.number}`);
  };

  const leave = () => {
    setLeaveOpen(false);
    setState({ activeTicketId: null, activeTicketStage: "cancelled" });
    router.replace("/(tabs)/home");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: dark.bg }} edges={["top"]}>
      <StatusBar barStyle="light-content" />
      <ScreenHeader
        testID="ticket-back-btn"
        tone="dark"
        title="Your ticket"
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/home"))}
        right={
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Animated.View
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: dark.success,
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
              }}
            />
            <Text style={[t.caption, { color: dark.muted }]}>Live</Text>
          </View>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        {/* Card-stack peek */}
        <View style={styles.peek} />

        {/* Ticket */}
        <View style={styles.ticket}>
          <View style={{ padding: 22, paddingBottom: 20 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={[t.eyebrow, { color: MUTED }]}>
                {ticket.number} · Spot {ticket.spot}
              </Text>
              <Text style={{ color: NAVY, fontWeight: "800", fontSize: 13, letterSpacing: 0.4 }}>{ticket.agencyCode}</Text>
            </View>

            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 14 }}>
              <View>
                <Text testID="ticket-number-display" style={styles.number}>
                  {ticket.number}
                </Text>
                <Text style={[t.footnote, { color: MUTED, marginTop: 4 }]}>Your number</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text testID="ticket-ahead" style={styles.number}>
                  {ahead}
                </Text>
                <Text style={[t.footnote, { color: MUTED, marginTop: 4 }]}>Ahead of you</Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", marginTop: 26, gap: 12 }}>
              <Field label="Est. wait" value={`${eta}m`} />
              <Field label="In this line" value={String(ahead + 1)} />
              <Field label="Status" value={statusLabel} testID="ticket-status" flex={1.4} />
            </View>

            <View style={{ flexDirection: "row", marginTop: 20, gap: 12 }}>
              <Field label="Branch" value={ticket.branch} flex={1} />
              <Field label="Service" value={ticket.service} flex={1} />
            </View>

            <View style={{ marginTop: 20 }}>
              <Text style={[t.eyebrow, { color: MUTED }]}>Ticket holder</Text>
              <Text style={{ color: NAVY, fontSize: 26, fontWeight: "800", letterSpacing: -0.6, marginTop: 6 }}>{ticket.holder}</Text>
            </View>
          </View>

          {/* Perforation */}
          <View style={styles.perfRow}>
            <View style={[styles.notch, { left: -14 }]} />
            <View style={styles.dashes}>
              {Array.from({ length: 34 }).map((_, i) => (
                <View key={i} style={styles.dash} />
              ))}
            </View>
            <View style={[styles.notch, { right: -14 }]} />
          </View>

          <View style={{ paddingHorizontal: 22, paddingTop: 18, paddingBottom: 24, alignItems: "center" }}>
            <Barcode height={72} />
            <Text testID="ticket-verification-code" style={styles.code}>
              {ticket.code.split("").join(" ")}
            </Text>
            <Text style={[t.eyebrow, { color: MUTED, fontSize: 10, marginTop: 6 }]}>Show this code at the counter</Text>
          </View>
        </View>

        {/* Contextual: heading in */}
        {stage === "almost_up" && (
          <View style={styles.banner}>
            <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" }}>
              <Footprints size={18} color="#fff" strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[t.headline, { color: "#fff" }]}>Start heading in</Text>
              <Text style={[t.footnote, { color: "#C7D7FB", marginTop: 2 }]}>You're next. Check in when you reach {ticket.branch}.</Text>
            </View>
            <Pressable testID="ticket-checkin-btn" onPress={advance} style={styles.bannerBtn}>
              <Check size={16} color={NAVY} strokeWidth={3} />
              <Text style={{ color: NAVY, fontWeight: "700", fontSize: 13 }}>I'm here</Text>
            </Pressable>
          </View>
        )}
        {stage === "checked_in" && (
          <View style={[styles.banner, { backgroundColor: "#14532D" }]}>
            <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" }}>
              <MapPin size={18} color="#fff" strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[t.headline, { color: "#fff" }]}>You're checked in</Text>
              <Text style={[t.footnote, { color: "#BBF7D0", marginTop: 2 }]}>Stay close — we'll call you to a counter shortly.</Text>
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
          <Pressable
            testID="ticket-notify-btn"
            onPress={() => setAlerts((a) => !a)}
            style={({ pressed }) => [styles.action, { backgroundColor: alerts ? "#14532D" : dark.accent, opacity: pressed ? 0.9 : 1 }]}
          >
            {alerts ? <BellRing size={18} color="#fff" strokeWidth={2} /> : <Bell size={18} color="#fff" strokeWidth={2} />}
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>{alerts ? "Alerts on" : "Notify me"}</Text>
          </Pressable>
          <Pressable
            testID="ticket-leave-btn"
            onPress={() => setLeaveOpen(true)}
            style={({ pressed }) => [styles.action, styles.leave, { opacity: pressed ? 0.8 : 1 }]}
          >
            <Text style={{ color: dark.danger, fontWeight: "700", fontSize: 15 }}>Leave queue</Text>
          </Pressable>
        </View>

        <Text style={[t.caption, { color: dark.muted, textAlign: "center", marginTop: 20 }]}>
          Estimates update as the line moves. Updated just now.
        </Text>

        {/* Prototype control */}
        <Pressable testID="ticket-advance-btn" onPress={advance} hitSlop={8} style={{ alignSelf: "center", marginTop: 14, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: dark.border }}>
          <Text style={[t.caption, { color: dark.muted }]}>
            {stage === "joined" ? "Preview · line moves" : stage === "almost_up" ? "Preview · check in" : "Preview · get called"}
          </Text>
        </Pressable>
      </ScrollView>

      <LeaveLineSheet visible={leaveOpen} onClose={() => setLeaveOpen(false)} onSelect={leave} />
    </SafeAreaView>
  );
}

function Field({ label, value, flex = 1, testID }: { label: string; value: string; flex?: number; testID?: string }) {
  return (
    <View style={{ flex }}>
      <Text style={[t.eyebrow, { color: MUTED }]}>{label}</Text>
      <Text testID={testID} numberOfLines={1} style={{ color: NAVY, fontSize: 17, fontWeight: "700", letterSpacing: -0.3, marginTop: 5 }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  peek: { height: 12, marginHorizontal: 14, backgroundColor: "#1B2940", borderRadius: 8, marginBottom: -2 },
  ticket: { backgroundColor: "#FFFFFF", borderRadius: 26, overflow: "hidden" },
  number: { color: NAVY, fontSize: 44, fontWeight: "800", letterSpacing: -1.5, lineHeight: 50 },
  perfRow: { height: 28, flexDirection: "row", alignItems: "center", position: "relative" },
  notch: { position: "absolute", width: 28, height: 28, borderRadius: 14, backgroundColor: dark.bg },
  dashes: { flex: 1, flexDirection: "row", justifyContent: "space-between", marginHorizontal: 26 },
  dash: { width: 5, height: 1.5, backgroundColor: "#CBD5E1", borderRadius: 1 },
  code: { color: NAVY, fontSize: 24, fontWeight: "800", letterSpacing: 5, marginTop: 14 },
  banner: { marginTop: 16, backgroundColor: dark.accent, borderRadius: 20, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  bannerBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#fff", height: 38, paddingHorizontal: 12, borderRadius: 12 },
  action: { flex: 1, height: 56, borderRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  leave: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: dark.borderStrong },
});
