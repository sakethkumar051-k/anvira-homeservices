import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NotificationRuntime } from "../components/NotificationRuntime";
import { BookingAlertsProvider } from "../components/BookingAlerts";
import { Provider } from "../lib/context";
import StagingNotice from "../components/StagingNotice";
import { WEBSITE_STAFF_ONLY } from "../lib/runtime";
export default function Layout() {
  const [loaded, error] = useFonts({
    Manrope: require("../../assets/fonts/Manrope-400.ttf"),
    ManropeSemi: require("../../assets/fonts/Manrope-600.ttf"),
    Telugu: require("../../assets/fonts/NotoSansTelugu-400.ttf"),
    TeluguSemi: require("../../assets/fonts/NotoSansTelugu-600.ttf"),
  });
  if (!loaded && !error)
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator color="#12634F" />
      </View>
    );
  return (
    <SafeAreaProvider>
      <Provider>
        <BookingAlertsProvider>
          <NotificationRuntime />
          <StatusBar style="dark" />
          <View style={{ flex: 1 }}>
            <StagingNotice />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "#F7F7F2" },
                animation: "fade",
              }}
            >
              <Stack.Screen name="welcome" />
              <Stack.Screen name="about" />
              <Stack.Protected guard={!WEBSITE_STAFF_ONLY}>
                {[
                  "home",
                  "quotes",
                  "care",
                  "services",
                  "service/[id]",
                  "checkout/[id]",
                  "addresses",
                  "bookings",
                  "partner",
                  "demo",
                  "jobs",
                  "earnings",
                ].map((name) => (
                  <Stack.Screen key={name} name={name} />
                ))}
              </Stack.Protected>
            </Stack>
          </View>
        </BookingAlertsProvider>
      </Provider>
    </SafeAreaProvider>
  );
}
