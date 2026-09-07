import { Tabs, useRouter } from "expo-router";
import { Home as HomeIcon, Search, Bookmark, User, Zap } from "lucide-react-native";
import { View, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { shadow } from "@/src/theme";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

const BAR_BG = "#1B2940";
const INACTIVE = "#8A9BB4";
const ACTIVE_ON_WHITE = "#0B192C";

function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const leftRoutes = state.routes.filter((r) => ["home", "find"].includes(r.name));
  const rightRoutes = state.routes.filter((r) => ["visits", "account"].includes(r.name));

  const renderIcon = (routeName: string, active: boolean) => {
    const color = active ? ACTIVE_ON_WHITE : INACTIVE;
    const sw = active ? 2.3 : 1.9;
    switch (routeName) {
      case "home":
        return <HomeIcon size={21} color={color} strokeWidth={sw} />;
      case "find":
        return <Search size={21} color={color} strokeWidth={sw} />;
      case "visits":
        return <Bookmark size={21} color={color} strokeWidth={sw} />;
      case "account":
        return <User size={21} color={color} strokeWidth={sw} />;
      default:
        return null;
    }
  };

  const renderTab = (route: (typeof state.routes)[number]) => {
    const index = state.routes.findIndex((r) => r.key === route.key);
    const isFocused = state.index === index;
    const onPress = () => {
      const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
      if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
    };
    return (
      <Pressable key={route.key} testID={`tab-${route.name}`} onPress={onPress} style={styles.tabItem} hitSlop={6}>
        {isFocused ? <View style={styles.activeCircle}>{renderIcon(route.name, true)}</View> : renderIcon(route.name, false)}
      </Pressable>
    );
  };

  return (
    <View style={[styles.wrap, { bottom: Math.max(insets.bottom, 14) + 6 }]}>
      <View style={[styles.bar, shadow.float]}>
        {leftRoutes.map(renderTab)}
        <Pressable
          testID="tab-center-action"
          onPress={() => router.push("/(tabs)/find")}
          hitSlop={6}
          style={({ pressed }) => [styles.centerAction, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}
        >
          <Zap size={21} color="#FFFFFF" fill="#FFFFFF" strokeWidth={1.5} />
        </Pressable>
        {rightRoutes.map(renderTab)}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: "transparent" } }}
    >
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="find" options={{ title: "Find" }} />
      <Tabs.Screen name="visits" options={{ title: "Saved" }} />
      <Tabs.Screen name="sessions" options={{ href: null }} />
      <Tabs.Screen name="account" options={{ title: "Account" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, alignItems: "center", pointerEvents: "box-none" },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BAR_BG,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  tabItem: { width: 52, height: 52, alignItems: "center", justifyContent: "center" },
  activeCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  centerAction: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#1D4ED8",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 6,
  },
});
