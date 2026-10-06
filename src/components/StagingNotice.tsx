import { View } from "react-native";
import { T, c } from "./ui";

export default function StagingNotice() {
  if (process.env.EXPO_PUBLIC_RELEASE_CHANNEL !== "staging") return null;
  return (
    <View
      style={{
        paddingHorizontal: 20,
        paddingVertical: 10,
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
