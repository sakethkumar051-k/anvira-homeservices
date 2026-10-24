import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useApp } from "../lib/context";
export function NotificationRuntime() {
  const { state, refresh } = useApp();
  const pending = useRef<Notifications.NotificationResponse | null>(null);
  const handled = useRef(new Set<string>());
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
    let timer: ReturnType<typeof setTimeout> | undefined;
    const key = (n: Notifications.NotificationResponse) =>
      JSON.stringify([n.notification.request.identifier, n.actionIdentifier]);
    function receive(n: Notifications.NotificationResponse | null) {
      if (!n) return;
      const id = n.notification.request.content.data?.bookingId;
      if (typeof id !== "string" || !/^[a-zA-Z0-9-]{1,100}$/.test(id)) return;
      const responseKey = key(n);
      if (handled.current.has(responseKey)) return;
      pending.current = n;
      if (!state?.user.id) return;
      clearTimeout(timer);
      // Let the sign-in screen finish its initial redirect before opening a booking.
      timer = setTimeout(() => {
        if (pending.current !== n || handled.current.has(responseKey)) return;
        router.push(("/booking/" + id) as never);
        handled.current.add(responseKey);
        pending.current = null;
        try {
          const last = Notifications.getLastNotificationResponse();
          if (last && key(last) === responseKey)
            Notifications.clearLastNotificationResponse();
        } catch {
          // Routing has completed; a native cache error must not open it twice.
        }
      }, 0);
    }
    const response =
      Notifications.addNotificationResponseReceivedListener(receive);
    try {
      receive(Notifications.getLastNotificationResponse());
    } catch {
      // A temporarily unavailable native cache must not disable live responses.
    }
    receive(pending.current);
    return () => {
      clearTimeout(timer);
      received.remove();
      response.remove();
    };
  }, [state?.user.id, refresh]);
  return null;
}
