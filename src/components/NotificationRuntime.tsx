import { useEffect } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useApp } from "../lib/context";
export function NotificationRuntime() {
  const { state, refresh } = useApp();
  useEffect(() => {
    if (Platform.OS === "web") return;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    const received = Notifications.addNotificationReceivedListener(
      () => void refresh(),
    );
    const response = Notifications.addNotificationResponseReceivedListener(
      (n) => {
        const id = n.notification.request.content.data?.bookingId;
        if (
          state?.user.id &&
          typeof id === "string" &&
          /^[a-zA-Z0-9-]{1,100}$/.test(id)
        )
          router.push(("/booking/" + id) as never);
      },
    );
    return () => {
      received.remove();
      response.remove();
    };
  }, [state?.user.id, refresh]);
  return null;
}
