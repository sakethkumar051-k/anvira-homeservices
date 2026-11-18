import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useApp } from "../lib/context";
import { useBookingAlerts } from "./BookingAlerts";
import { configureAlertChannels } from "../lib/notification-channels";
import {
  currentPartnerAlert,
  isPartnerOfferAlert,
  notificationRoute,
} from "../lib/notification-policy";
export function NotificationRuntime() {
  const { state, refresh, read } = useApp();
  const { enabled } = useBookingAlerts();
  const pending = useRef<Notifications.NotificationResponse | null>(null);
  const handled = useRef(new Set<string>());
  const presented = useRef(new Set<string>());
  const session = useRef("");
  const sound = useRef(enabled);
  useEffect(() => {
    session.current = [state?.user.id, state?.user.role].join(":");
    sound.current = enabled;
  }, [state?.user.id, state?.user.role, enabled]);
  useEffect(() => {
    if (Platform.OS === "web") return;
    let active = true;
    void configureAlertChannels().catch(() => {});
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const hidden = {
          shouldShowBanner: false,
          shouldShowList: false,
          shouldPlaySound: false,
          shouldSetBadge: false,
        };
        if (!state?.user.id) return hidden;
        const account = session.current;
        const data = notification.request.content.data || {};
        if (data.kind === "partner_offer") {
          if (
            state.user.role !== "professional" ||
            !isPartnerOfferAlert(data) ||
            data.expiresAt <= Date.now()
          )
            return hidden;
          let timeout: ReturnType<typeof setTimeout> | undefined;
          try {
            // Native foreground handlers must finish within three seconds.
            const result = await Promise.race([
              read<{
                offers: { id: string; roundId: string; expiresAt: number }[];
              }>("/partner-offers"),
              new Promise<null>((resolve) => {
                timeout = setTimeout(() => resolve(null), 1500);
              }),
            ]);
            if (!result || !currentPartnerAlert(data, result.offers))
              return hidden;
          } catch {
            return hidden;
          } finally {
            clearTimeout(timeout);
          }
        }
        if (!active || session.current !== account) return hidden;
        const identity = isPartnerOfferAlert(data)
          ? data.offerId + ":" + data.roundId
          : data.notificationId || notification.request.identifier;
        const key = account + ":" + identity;
        if (presented.current.has(key)) return hidden;
        presented.current.add(key);
        if (presented.current.size > 500)
          presented.current.delete(presented.current.values().next().value!);
        return {
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: sound.current,
          shouldSetBadge: false,
        };
      },
    });
    const received = Notifications.addNotificationReceivedListener(
      () => void refresh(),
    );
    let timer: ReturnType<typeof setTimeout> | undefined;
    const key = (n: Notifications.NotificationResponse) =>
      JSON.stringify([n.notification.request.identifier, n.actionIdentifier]);
    function receive(n: Notifications.NotificationResponse | null) {
      if (!n) return;
      const data = n.notification.request.content.data || {};
      if (data.kind === "partner_offer" && !isPartnerOfferAlert(data)) return;
      if (data.kind !== "partner_offer" && !notificationRoute(data)) return;
      const responseKey = key(n);
      if (handled.current.has(responseKey)) return;
      pending.current = n;
      if (!state?.user.id) return;
      const destination = notificationRoute(data, state.user.role);
      if (!destination) return;
      clearTimeout(timer);
      // Let the sign-in screen finish its initial redirect before opening a booking.
      timer = setTimeout(() => {
        if (pending.current !== n || handled.current.has(responseKey)) return;
        void refresh();
        router.push(destination as never);
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
      active = false;
      clearTimeout(timer);
      received.remove();
      response.remove();
    };
  }, [state?.user.id, state?.user.role, refresh, read]);
  return null;
}
