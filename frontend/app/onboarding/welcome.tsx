import { useRouter } from "expo-router";
import { useState, useRef } from "react";
import { View, Text, ScrollView, Pressable, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent, StyleSheet, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Clock, Users, MapPin, ArrowRight } from "lucide-react-native";
import { type as t } from "@/src/theme";
import { LogoMark } from "@/src/components/auth-ui";

const SLIDES = [
  {
    key: "join",
    title: "Join a line from anywhere",
    body: "Pick a branch and service. See live wait estimates before you decide to join.",
    Icon: MapPin,
  },
  {
    key: "follow",
    title: "Follow your turn",
    body: "Track your position and estimated wait — go on with your day while Lyne holds your place.",
    Icon: Users,
  },
  {
    key: "arrive",
    title: "Arrive at the right time",
    body: "We alert you when to head in. Check in, get called to your counter, and show your code.",
    Icon: Clock,
  },
];

export default function Welcome() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / width);
    if (p !== page) setPage(p);
  };

  const next = () => {
    if (page < SLIDES.length - 1) scrollRef.current?.scrollTo({ x: (page + 1) * width, animated: true });
    else router.push("/onboarding/auth");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B1424" }}>
      <StatusBar barStyle="light-content" />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, height: 60 }}>
        <LogoMark size={36} />
        <Pressable testID="onboarding-skip" onPress={() => router.push("/onboarding/auth")} hitSlop={8}>
          <Text style={{ color: "#8A9BB4", fontSize: 15, fontWeight: "600" }}>Skip</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 40 }}
      >
        {SLIDES.map((s) => (
          <View key={s.key} style={{ width, paddingHorizontal: 28, justifyContent: "center" }}>
            <View style={styles.iconWrap}>
              <s.Icon size={56} color="#fff" strokeWidth={1.5} />
            </View>
            <Text style={[t.display, { color: "#F8FAFC", marginTop: 36 }]}>{s.title}</Text>
            <Text style={[t.body, { color: "#B7C3D6", marginTop: 14, fontSize: 16, lineHeight: 24 }]}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 28, marginBottom: 24 }}>
        {SLIDES.map((_, i) => (
          <View key={i} style={{ width: i === page ? 28 : 8, height: 8, borderRadius: 4, backgroundColor: i === page ? "#3B82F6" : "rgba(255,255,255,0.18)" }} />
        ))}
      </View>

      <View style={{ paddingHorizontal: 20, paddingBottom: 12, gap: 6 }}>
        <Pressable testID="onboarding-next-btn" onPress={next} style={({ pressed }) => [styles.primary, { opacity: pressed ? 0.9 : 1 }]}>
          <Text style={{ color: "#0B192C", fontSize: 16, fontWeight: "700" }}>{page === SLIDES.length - 1 ? "Get started" : "Next"}</Text>
          <ArrowRight size={18} color="#0B192C" strokeWidth={2.4} />
        </Pressable>
        <Pressable testID="onboarding-signin" onPress={() => router.push("/onboarding/auth")} style={{ paddingVertical: 14, alignItems: "center" }}>
          <Text style={{ color: "#9DB8F5", fontSize: 15, fontWeight: "600" }}>I already have an account</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 36,
    backgroundColor: "#1D4ED8",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-6deg" }],
  },
  primary: { height: 58, borderRadius: 999, backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
});
