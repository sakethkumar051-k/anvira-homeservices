import { router } from "expo-router";
import { View } from "react-native";
import { T, Button } from "../components/ui";
export default function NotFound() {
  return (
    <View style={{ padding: 40, gap: 20 }}>
      <T bold size={24}>
        Page not found
      </T>
      <Button label="Go to start" onPress={() => router.replace("/")} />
    </View>
  );
}
