import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import {
  PARTNER_OFFER_CHANNEL,
  PARTNER_OFFER_SOUND,
} from "./notification-policy";

export async function configureAlertChannels() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Booking updates",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    enableVibrate: true,
    vibrationPattern: [0, 250, 150, 250],
  });
  await Notifications.setNotificationChannelAsync(PARTNER_OFFER_CHANNEL, {
    name: "Partner job offers",
    description:
      "Time-limited service offers available to your partner account.",
    importance: Notifications.AndroidImportance.HIGH,
    sound: PARTNER_OFFER_SOUND,
    enableVibrate: true,
    vibrationPattern: [0, 250, 150, 250],
  });
}
