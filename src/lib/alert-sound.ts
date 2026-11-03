import { Vibration } from "react-native";
import * as Notifications from "expo-notifications";
import { configureAlertChannels } from "./notification-channels";
export async function primeAlertSound() {
  await configureAlertChannels();
  const permissions = await Notifications.getPermissionsAsync();
  if (permissions.status !== "granted") {
    const granted = await Notifications.requestPermissionsAsync();
    if (granted.status !== "granted")
      throw new Error("Notifications are disabled.");
  }
}
export async function playAlertSound() {
  Vibration.vibrate([0, 250, 150, 250]);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "ANVIRA booking alert",
      body: "Open your notification inbox for booking updates.",
      sound: "default",
    },
    trigger: null,
  });
}
