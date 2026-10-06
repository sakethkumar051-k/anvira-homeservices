import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NotificationRuntime } from "../components/NotificationRuntime";
import { Provider } from "../lib/context";
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
        <NotificationRuntime />
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#F7F7F2" },
            animation: "fade",
          }}
        />
      </Provider>
    </SafeAreaProvider>
  );
}
