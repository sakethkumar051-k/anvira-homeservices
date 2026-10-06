import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import * as Apple from "expo-apple-authentication";
export default function AppleSignInButton({
  onPress,
  disabled,
}: {
  onPress: () => void;
  disabled: boolean;
}) {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let current = true;
    if (
      Platform.OS === "ios" &&
      process.env.EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED === "true"
    )
      void Apple.isAvailableAsync()
        .then((v) => {
          if (current) setAvailable(v);
        })
        .catch(() => {});
    return () => {
      current = false;
    };
  }, []);
  if (!available) return null;
  return (
    <View
      pointerEvents={disabled ? "none" : "auto"}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <Apple.AppleAuthenticationButton
        buttonType={Apple.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={Apple.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={12}
        style={{ height: 50, width: "100%" }}
        onPress={onPress}
      />
    </View>
  );
}
