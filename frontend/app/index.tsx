import { useEffect } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import { useRouter } from "expo-router";
import { useRef } from "react";
import { useTheme, fonts, spacing } from "@/src/theme";
import { useAppStore } from "@/src/store/app-store";

export default function SplashIndex() {
  const router = useRouter();
  const { colors } = useTheme();
  const onboardingComplete = useAppStore((s) => s.onboardingComplete);

  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 1500,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start();

    const t = setTimeout(() => {
      if (onboardingComplete) {
        router.replace("/(tabs)/home");
      } else {
        router.replace("/onboarding/welcome");
      }
    }, 1600);
    return () => clearTimeout(t);
  }, []);

  const barWidth = anim.interpolate({ inputRange: [0, 1], outputRange: ["10%", "80%"] });

  return (
    <View style={[styles.container, { backgroundColor: "#0B1424" }]}>
      <View style={styles.center}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 20,
            backgroundColor: colors.brandPrimary,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: spacing.md,
          }}
        >
          <Text
            style={{ color: colors.onBrandPrimary, fontSize: 34, fontWeight: "800", fontFamily: fonts.bold }}
          >
            L
          </Text>
        </View>
        <Text
          testID="splash-title"
          style={{ color: colors.onBrand, fontSize: 40, fontWeight: "800", letterSpacing: 0.5, fontFamily: fonts.bold }}
        >
          Lyne
        </Text>
        <Text style={{ color: "#93C5FD", marginTop: 8, fontSize: 15, fontFamily: fonts.regular }}>
          Your time. Better spent.
        </Text>
        <View style={styles.trackWrap}>
          <View style={styles.track}>
            <Animated.View style={[styles.fill, { width: barWidth, backgroundColor: colors.brandPrimary }]} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  trackWrap: { marginTop: 40, width: "70%" },
  track: {
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.15)",
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 999 },
});
