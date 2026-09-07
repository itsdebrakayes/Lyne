import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { LogBox, StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { queryClient } from "@/src/query-client";

LogBox.ignoreAllLogs(true);

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <StatusBar barStyle="dark-content" />
            <Stack screenOptions={{ headerShown: false, animation: "slide_from_right", contentStyle: { backgroundColor: "#F3F5F9" } }} />
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
