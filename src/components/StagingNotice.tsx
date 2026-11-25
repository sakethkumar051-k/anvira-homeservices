import { usePathname } from "expo-router";
import { WEBSITE_STAFF_ONLY } from "../lib/runtime";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { T, c } from "./ui";

export default function StagingNotice() {
  const path = usePathname();
  const insets = useSafeAreaInsets();
  if (WEBSITE_STAFF_ONLY && ["/welcome", "/about"].includes(path)) return null;
  if (process.env.EXPO_PUBLIC_RELEASE_CHANNEL !== "staging") return null;
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", top: insets.top, right: 20, zIndex: 10 }}
    >
      <T size={8} color={c.amber}>
        Client preview · test mode
      </T>
    </View>
  );
}
