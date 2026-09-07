import { useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, ScrollView, Pressable, StyleSheet, StatusBar } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, CheckCheck, CheckCircle2, Bell, MapPin, Ticket } from "lucide-react-native";
import { dark, type as t } from "@/src/theme";
import { serviceById, branchById, LINE_STATS, SERVICES, BRANCHES, agencyById, checklistFor, CURRENT_USER } from "@/src/data/mock";
import { BackButton, Eyebrow, Monogram } from "@/src/components/primitives";
import { HoldButton } from "@/src/components/hold-button";
import { setState } from "@/src/store/app-store";

const NAVY = "#0B192C";

export default function JoinReady() {
  const { serviceId, branchId, agencyId } = useLocalSearchParams<{ serviceId: string; branchId: string; agencyId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const svc = serviceById(serviceId!) ?? SERVICES[0];
  const branch = branchById(branchId!) ?? BRANCHES[0];
  const agency = agencyById(agencyId || "a1")!;
  const stats = LINE_STATS[svc.id];
  const items = useMemo(() => checklistFor(svc), [svc]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const required = items.filter((i) => i.required);
  const allRequired = required.every((i) => checked[i.id]);
  const toggle = (id: string) => setChecked((c) => ({ ...c, [id]: !c[id] }));

  const join = () => {
    const prefix = svc.name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
    const number = `${prefix}-${String(stats.inLine + 3).padStart(3, "0")}`;
    setState({
      onboardingComplete: true,
      activeTicketId: number,
      activeTicketStage: "joined",
      peopleAhead: stats.inLine,
      etaMins: stats.waitMins,
      ticket: {
        number,
        spot: stats.inLine + 1,
        ahead: stats.inLine,
        etaMins: stats.waitMins,
        branch: branch.name,
        service: svc.name,
        agencyCode: agency.code,
        agencyName: agency.name,
        holder: CURRENT_USER.fullName,
        code: "FHTDA9",
      },
    });
    router.replace(`/ticket/${number}`);
  };

  const bring = items.filter((i) => i.group === "bring");
  const before = items.filter((i) => i.group === "before");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: dark.bg }} edges={["top"]}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140 }}>
        <View style={{ paddingTop: 10, marginBottom: 26 }}>
          <BackButton testID="ready-back-btn" tone="dark" onPress={() => router.back()} />
        </View>

        <Eyebrow color="#9DB8F5">Join remotely</Eyebrow>
        <Text style={[t.display, { color: dark.text, marginTop: 8 }]}>Take your spot{"\n"}from anywhere.</Text>
        <Text style={[t.body, { color: dark.textSecondary, marginTop: 14 }]}>
          You are joining {svc.name} at {agency.name} · {branch.name}.
        </Text>

        {/* Summary card */}
        <View style={styles.summary}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
            <Monogram code={agency.code} bg="#FFFFFF" fg={NAVY} size={44} radius={12} />
            <View style={{ flex: 1 }}>
              <Text style={[t.footnote, { color: dark.muted }]}>{agency.name}</Text>
              <Text style={[t.title2, { color: dark.text, marginTop: 2 }]}>{svc.name}</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", marginTop: 22 }}>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={styles.bigStat}>{stats.inLine}</Text>
              <Text style={[t.footnote, { color: dark.muted, marginTop: 2 }]}>ahead</Text>
            </View>
            <View style={{ width: 1, backgroundColor: dark.borderStrong, marginVertical: 4 }} />
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={styles.bigStat}>
                {stats.waitMins}
                <Text style={{ fontSize: 15, fontWeight: "600" }}>m</Text>
              </Text>
              <Text style={[t.footnote, { color: dark.muted, marginTop: 2 }]}>est. wait</Text>
            </View>
          </View>
        </View>

        <Text style={[t.callout, { color: dark.textSecondary, marginTop: 18 }]}>{svc.description}</Text>

        {/* Checklist */}
        <View style={styles.checklist}>
          <View style={styles.checklistHead}>
            <View style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
              <CheckCheck size={22} color="#16A34A" strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[t.title3, { color: NAVY }]}>Have these ready</Text>
              <Text style={[t.footnote, { color: "#475569", marginTop: 4 }]}>
                Tick each required item before taking your place. Staff will still check at the branch.
              </Text>
            </View>
          </View>

          <View style={{ padding: 18, paddingTop: 16 }}>
            <Eyebrow>Bring with you</Eyebrow>
            {bring.map((item, i) => (
              <CheckRow key={item.id} item={item} checked={!!checked[item.id]} onToggle={() => toggle(item.id)} last={i === bring.length - 1} />
            ))}

            <Eyebrow style={{ marginTop: 18 }}>Do before you arrive</Eyebrow>
            {before.map((item, i) => (
              <CheckRow key={item.id} item={item} checked={!!checked[item.id]} onToggle={() => toggle(item.id)} last={i === before.length - 1} />
            ))}

            <View style={[styles.confirm, allRequired ? { backgroundColor: "#ECFDF3" } : { backgroundColor: "#F3F5F9" }]}>
              {allRequired ? (
                <CheckCircle2 size={18} color="#fff" fill="#16A34A" strokeWidth={2} />
              ) : (
                <CheckCircle2 size={18} color="#94A3B8" strokeWidth={2} />
              )}
              <Text style={[t.footnote, { color: allRequired ? "#14532D" : "#64748B", flex: 1, fontWeight: "500" }]}>
                {allRequired
                  ? "Required items confirmed. You can join when the line is open."
                  : `${required.filter((r) => checked[r.id]).length} of ${required.length} required items ticked.`}
              </Text>
            </View>
          </View>
        </View>

        {/* What happens next */}
        <View style={styles.next}>
          <Text style={[t.title3, { color: dark.text, marginBottom: 14 }]}>What happens next</Text>
          <NextRow icon={<Ticket size={18} color="#9DB8F5" />} title="You get a ticket" body="Your spot is held the moment you join — no need to be at the branch." />
          <NextRow icon={<Bell size={18} color="#9DB8F5" />} title="We alert you" body="Updates as the line moves, and a heads-up when it is time to head in." />
          <NextRow icon={<MapPin size={18} color="#9DB8F5" />} title="Arrive and check in" body="Show your code at the counter when you are called." last />
        </View>
      </ScrollView>

      {/* Sticky action */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <HoldButton
          testID="ready-hold-join"
          label="Hold to join the line"
          holdingLabel="Keep holding…"
          disabled={!allRequired}
          disabledLabel="Check the required items first"
          onComplete={join}
        />
      </View>
    </SafeAreaView>
  );
}

function CheckRow({ item, checked, onToggle, last }: { item: ReturnType<typeof checklistFor>[number]; checked: boolean; onToggle: () => void; last?: boolean }) {
  return (
    <Pressable
      testID={`check-${item.id}`}
      onPress={onToggle}
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 14,
        paddingVertical: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: "#EEF2F7",
      }}
    >
      <View style={[styles.box, checked ? { backgroundColor: "#1D4ED8", borderColor: "#1D4ED8" } : null]}>
        {checked && <Check size={16} color="#fff" strokeWidth={3} />}
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Text style={[t.headline, { color: NAVY }]}>{item.label}</Text>
          <Text style={{ fontSize: 10, fontWeight: "800", letterSpacing: 0.6, color: item.required ? "#DC2626" : "#64748B" }}>
            {item.required ? "REQUIRED" : "HELPFUL"}
          </Text>
        </View>
        <Text style={[t.footnote, { color: "#64748B", marginTop: 3 }]}>{item.hint}</Text>
      </View>
    </Pressable>
  );
}

function NextRow({ icon, title, body, last }: { icon: React.ReactNode; title: string; body: string; last?: boolean }) {
  return (
    <View style={{ flexDirection: "row", gap: 14, paddingBottom: last ? 0 : 16 }}>
      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: dark.accentSoft, alignItems: "center", justifyContent: "center" }}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={[t.headline, { color: dark.text }]}>{title}</Text>
        <Text style={[t.footnote, { color: dark.muted, marginTop: 2 }]}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { marginTop: 22, backgroundColor: dark.card, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: dark.border },
  bigStat: { color: dark.text, fontSize: 26, fontWeight: "800", letterSpacing: -0.6 },
  checklist: { marginTop: 22, backgroundColor: "#FFFFFF", borderRadius: 24, overflow: "hidden" },
  checklistHead: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 18, paddingBottom: 16, backgroundColor: "#ECFDF3" },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 1.5, borderColor: "#CBD5E1", backgroundColor: "#F3F5F9", alignItems: "center", justifyContent: "center", marginTop: 1 },
  confirm: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, padding: 12, marginTop: 16 },
  next: { marginTop: 14, backgroundColor: dark.card, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: dark.border },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: dark.bg },
});
