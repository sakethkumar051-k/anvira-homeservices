import { Platform } from "react-native";
import {
  AndroidImportance,
  setNotificationChannelAsync,
} from "expo-notifications";
import {
  PARTNER_OFFER_CHANNEL,
  PARTNER_OFFER_SOUND,
} from "./notification-policy";

export async function configureAlertChannels() {
  if (Platform.OS !== "android") return;
  await setNotificationChannelAsync("default", {
    name: "Booking updates",
    importance: AndroidImportance.HIGH,
    sound: "default",
    enableVibrate: true,
    vibrationPattern: [0, 250, 150, 250],
  });
  await setNotificationChannelAsync(PARTNER_OFFER_CHANNEL, {
    name: "Partner job offers",
    description:
      "Time-limited service offers available to your partner account.",
    importance: AndroidImportance.HIGH,
    sound: PARTNER_OFFER_SOUND,
    enableVibrate: true,
    vibrationPattern: [0, 250, 150, 250],
  });
}
