import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { View, Text, Pressable, KeyboardAvoidingView, Platform, ScrollView, TextInput, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowRight, Calendar } from "lucide-react-native";
import { type as t } from "@/src/theme";
import { AuthField, LogoMark } from "@/src/components/auth-ui";
import { TileBackdrop } from "@/src/components/tile-backdrop";
import { BackButton } from "@/src/components/primitives";
import { setState } from "@/src/store/app-store";

const CANVAS = "#F3F5F9";

export default function SignUp() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "otp">("form");
  const [form, setForm] = useState({ name: "", email: "", phone: "", dob: "", trn: "", password: "", confirm: "" });
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const refs = useRef<(TextInput | null)[]>([]);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const verify = () => {
    setState({ onboardingComplete: true, isAuthed: true });
    router.replace("/(tabs)/home");
  };

  return (
    <View style={{ flex: 1, backgroundColor: CANVAS }}>
      <TileBackdrop />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
            <BackButton testID="signup-back-btn" onPress={() => (step === "otp" ? setStep("form") : router.back())} />
          </View>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 28, paddingTop: 24, paddingBottom: 120 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <LogoMark />
            {step === "form" ? (
              <>
                <Text style={[t.title1, { color: "#0B192C", textAlign: "center", marginTop: 20 }]}>Create your account</Text>
                <Text style={[t.body, { color: "#64748B", textAlign: "center", marginTop: 8, paddingHorizontal: 12 }]}>
                  A few details and you're ready to skip the line.
                </Text>

                <View style={{ gap: 18, marginTop: 30 }}>
                  <AuthField testID="signup-name" label="Full name" value={form.name} onChangeText={set("name")} placeholder="e.g. Debra Samuels" autoComplete="name" />
                  <AuthField testID="signup-email" label="Email address" value={form.email} onChangeText={set("email")} placeholder="you@email.com" keyboardType="email-address" autoCapitalize="none" />
                  <AuthField testID="signup-phone" label="Phone number" value={form.phone} onChangeText={set("phone")} placeholder="876-000-0000" keyboardType="phone-pad" />
                  <AuthField
                    testID="signup-dob"
                    label="Date of birth"
                    value={form.dob}
                    onChangeText={set("dob")}
                    placeholder="Select your date of birth"
                    right={<Calendar size={18} color="#94A3B8" />}
                  />
                  <AuthField testID="signup-trn" label="TRN" value={form.trn} onChangeText={set("trn")} placeholder="000-000-000" keyboardType="number-pad" />
                  <AuthField testID="signup-password" label="Password" value={form.password} onChangeText={set("password")} placeholder="Min. 8 characters" secure />
                  <AuthField testID="signup-confirm" label="Confirm password" value={form.confirm} onChangeText={set("confirm")} placeholder="Re-enter your password" secure />
                </View>

                <Pressable testID="signup-submit-btn" onPress={() => setStep("otp")} style={({ pressed }) => [styles.primary, { opacity: pressed ? 0.9 : 1 }]}>
                  <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Create account</Text>
                  <ArrowRight size={18} color="#fff" strokeWidth={2.4} />
                </Pressable>

                <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 22, gap: 6 }}>
                  <Text style={[t.callout, { color: "#64748B" }]}>Already have an account?</Text>
                  <Pressable testID="signup-signin-link" onPress={() => router.back()} hitSlop={8}>
                    <Text style={[t.callout, { color: "#0B192C", fontWeight: "700" }]}>Sign in</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={[t.title1, { color: "#0B192C", textAlign: "center", marginTop: 20 }]}>Enter the six-digit code</Text>
                <Text style={[t.body, { color: "#64748B", textAlign: "center", marginTop: 8 }]}>
                  We sent a code to {form.phone || form.email || "your phone"}.
                </Text>

                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 32 }}>
                  {otp.map((v, i) => (
                    <TextInput
                      key={i}
                      testID={`otp-${i}`}
                      ref={(r) => {
                        refs.current[i] = r;
                      }}
                      value={v}
                      onChangeText={(txt) => {
                        const next = [...otp];
                        next[i] = txt.slice(-1);
                        setOtp(next);
                        if (txt && i < 5) refs.current[i + 1]?.focus();
                      }}
                      keyboardType="number-pad"
                      maxLength={1}
                      style={[styles.otp, v ? { borderColor: "#1D4ED8", backgroundColor: "#fff" } : null]}
                    />
                  ))}
                </View>

                <Text style={[t.callout, { color: "#64748B", textAlign: "center", marginTop: 20 }]}>
                  Didn't get the code? <Text style={{ color: "#1D4ED8", fontWeight: "600" }}>Resend</Text>
                </Text>

                <Pressable testID="auth-verify-btn" onPress={verify} style={({ pressed }) => [styles.primary, { opacity: pressed ? 0.9 : 1 }]}>
                  <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Verify & continue</Text>
                  <ArrowRight size={18} color="#fff" strokeWidth={2.4} />
                </Pressable>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  primary: {
    marginTop: 28,
    height: 58,
    borderRadius: 999,
    backgroundColor: "#0B192C",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  otp: {
    width: 48,
    height: 60,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E6EAF0",
    backgroundColor: "#F3F5F9",
    textAlign: "center",
    fontSize: 24,
    fontWeight: "700",
    color: "#0B192C",
  },
});
