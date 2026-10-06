import { Platform, Vibration } from "react-native";
import * as Notifications from "expo-notifications";
export async function primeAlertSound() {
  const permissions = await Notifications.getPermissionsAsync();
  if (permissions.status !== "granted") {
    const granted = await Notifications.requestPermissionsAsync();
    if (granted.status !== "granted") throw new Error("Notifications are disabled.");
  }
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("default", {
      name: "Booking updates",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      enableVibrate: true,
      vibrationPattern: [0, 250, 150, 250],
    });
}
export async function playAlertSound() {
  Vibration.vibrate([0, 250, 150, 250]);
  await Notifications.scheduleNotificationAsync({content: {title: "ANVIRA booking alert", body: "Open your notification inbox for booking updates.", sound: "default"}, trigger: null});
}
