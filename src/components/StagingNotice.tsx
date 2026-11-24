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
      style={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 10,
        paddingBottom: 10,
        backgroundColor: c.amberbg,
      }}
    >
      <T bold color={c.amber}>
        Client preview · setup in progress
      </T>
      <T size={12}>
        Use this preview for testing. Service availability and customer launch
        are still being prepared.
      </T>
    </View>
  );
}
