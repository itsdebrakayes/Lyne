import { useRouter } from "expo-router";
import { useState } from "react";
import { View, Text, Pressable, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowRight, Apple } from "lucide-react-native";
import { type as t } from "@/src/theme";
import { AuthField, LogoMark } from "@/src/components/auth-ui";
import { TileBackdrop } from "@/src/components/tile-backdrop";
import { setState } from "@/src/store/app-store";

const CANVAS = "#F3F5F9";

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const signIn = () => {
    setState({ onboardingComplete: true, isAuthed: true });
    router.replace("/(tabs)/home");
  };
  const guest = () => {
    setState({ onboardingComplete: true, isAuthed: false });
    router.replace("/(tabs)/home");
  };

  return (
    <View style={{ flex: 1, backgroundColor: CANVAS }}>
      <TileBackdrop />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 28, paddingVertical: 40 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <LogoMark />
            <Text style={[t.title1, { color: "#0B192C", textAlign: "center", marginTop: 20 }]}>Lyne</Text>
            <Text style={[t.body, { color: "#64748B", textAlign: "center", marginTop: 6 }]}>Sign in to skip the line.</Text>

            <View style={{ gap: 12, marginTop: 30 }}>
              <AuthField
                testID="auth-email-input"
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email address"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              <AuthField testID="auth-password-input" value={password} onChangeText={setPassword} placeholder="Password" secure />
            </View>

            <Pressable testID="auth-continue-btn" onPress={signIn} style={({ pressed }) => [styles.primary, { opacity: pressed ? 0.9 : 1 }]}>
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Sign in</Text>
              <ArrowRight size={18} color="#fff" strokeWidth={2.4} />
            </Pressable>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 22 }}>
              <View style={styles.rule} />
              <Text style={[t.caption, { color: "#94A3B8" }]}>or</Text>
              <View style={styles.rule} />
            </View>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={styles.social}>
                <Apple size={18} color="#94A3B8" fill="#94A3B8" />
                <Text style={styles.socialText}>Apple</Text>
              </View>
              <View style={styles.social}>
                <Text style={[styles.socialText, { fontSize: 17, fontWeight: "800" }]}>G</Text>
                <Text style={styles.socialText}>Google</Text>
              </View>
            </View>
            <Text style={[t.caption, { color: "#94A3B8", textAlign: "center", marginTop: 12, fontWeight: "400" }]}>
              Apple and Google sign-in arrive with the App Store release.
            </Text>

            <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 26, gap: 6 }}>
              <Text style={[t.callout, { color: "#64748B" }]}>Don't have an account?</Text>
              <Pressable testID="auth-signup-link" onPress={() => router.push("/onboarding/signup")} hitSlop={8}>
                <Text style={[t.callout, { color: "#0B192C", fontWeight: "700" }]}>Sign up</Text>
              </Pressable>
            </View>
            <Pressable testID="auth-guest-btn" onPress={guest} hitSlop={8} style={{ alignSelf: "center", marginTop: 14, paddingVertical: 6 }}>
              <Text style={[t.callout, { color: "#1D4ED8", fontWeight: "600" }]}>Browse as guest</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  primary: {
    marginTop: 16,
    height: 58,
    borderRadius: 999,
    backgroundColor: "#0B192C",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  rule: { flex: 1, height: 1, backgroundColor: "#E2E8F0" },
  social: {
    flex: 1,
    height: 52,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderWidth: 1,
    borderColor: "#E6EAF0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  socialText: { color: "#94A3B8", fontWeight: "600", fontSize: 15 },
});
