import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";
import { useApp } from "../lib/context";
import { AppState } from "../lib/model";
import { primeAlertSound, playAlertSound } from "../lib/alert-sound";
import {
  currentPartnerAlert,
  notificationRoute,
} from "../lib/notification-policy";
import { T, c, Row, Button, Badge } from "./ui";

type Alert = AppState["notifications"][number];
type Alerts = {
  enabled: boolean;
  toggle: () => Promise<void>;
  test: () => Promise<void>;
  message: string;
  banner: React.ReactNode;
};
const Context = createContext<Alerts>({
  enabled: false,
  toggle: async () => {},
  test: async () => {},
  message: "",
  banner: null,
});
export const useBookingAlerts = () => useContext(Context);
export function BookingAlertsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { state } = useApp();
  return (
    <BookingAlertsSession key={state?.user.id || "signed-out"}>
      {children}
    </BookingAlertsSession>
  );
}
function BookingAlertsSession({ children }: { children: React.ReactNode }) {
  const { state, request, read } = useApp(),
    userId = state?.user.id || "";
  const [enabled, setEnabled] = useState(false),
    [message, setMessage] = useState(""),
    [current, setCurrent] = useState<Alert | null>(null),
    [ready, setReady] = useState(false);
  const seen = useRef(new Set<string>()),
    baseline = useRef(false),
    user = useRef("");
  useEffect(() => {
    user.current = userId;
    seen.current.clear();
    baseline.current = false;
    if (!userId) return;
    const key = "anvira-alerts-" + userId;
    const read =
      Platform.OS === "web"
        ? Promise.resolve().then(() => localStorage.getItem(key))
        : SecureStore.getItemAsync(key);
    void read
      .then((value) => {
        if (user.current === userId) {
          setEnabled(value === "on");
          setReady(true);
        }
      })
      .catch(() => {
        if (user.current === userId) setReady(true);
      });
  }, [userId]);
  useEffect(() => {
    if (!userId || !ready) return;
    const notifications = state?.notifications || [];
    const fresh = notifications.filter(
      (n) => !n.read && !seen.current.has(n.id),
    );
    for (const n of notifications) seen.current.add(n.id);
    if (seen.current.size > 1000)
      seen.current = new Set(notifications.map((n) => n.id));
    if (!baseline.current) {
      baseline.current = true;
      return;
    }
    let cancelled = false;
    async function present() {
      for (const alert of fresh) {
        if (alert.kind === "partner_offer") {
          if (
            state?.user.role !== "professional" ||
            !alert.expiresAt ||
            alert.expiresAt <= Date.now()
          )
            continue;
          try {
            const result = await read<{
              offers: { id: string; roundId: string; expiresAt: number }[];
            }>("/partner-offers");
            if (!currentPartnerAlert(alert, result.offers)) continue;
          } catch {
            continue;
          }
        }
        if (cancelled) return;
        setCurrent(alert);
        // Native remote notifications own the sound; polling must not duplicate it.
        if (enabled && Platform.OS === "web")
          void playAlertSound().catch(() => {});
        return;
      }
    }
    void present();
    return () => {
      cancelled = true;
    };
  }, [state?.notifications, state?.user.role, userId, enabled, ready, read]);
  useEffect(() => {
    if (current?.kind !== "partner_offer") return;
    let cancelled = false;
    const timer = setTimeout(
      () => setCurrent(null),
      state?.user.role === "professional"
        ? Math.max(0, (current.expiresAt || 0) - Date.now())
        : 0,
    );
    if (state?.user.role === "professional")
      void read<{
        offers: { id: string; roundId: string; expiresAt: number }[];
      }>("/partner-offers")
        .then((result) => {
          if (!cancelled && !currentPartnerAlert(current, result.offers))
            setCurrent(null);
        })
        .catch(() => {
          if (!cancelled) setCurrent(null);
        });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [current, state?.notifications, state?.user.role, read]);
  async function toggle() {
    try {
      const next = !enabled;
      if (next) {
        await primeAlertSound();
        await playAlertSound();
      }
      setEnabled(next);
      const key = "anvira-alerts-" + userId;
      if (Platform.OS === "web") localStorage.setItem(key, next ? "on" : "off");
      else await SecureStore.setItemAsync(key, next ? "on" : "off");
      setMessage(
        next
          ? Platform.OS === "web"
            ? "Booking alert sound enabled. Keep the website open for live alerts."
            : "Foreground alert sound enabled. Your phone settings control background notifications."
          : "Foreground sound muted. Your notification inbox still receives updates.",
      );
    } catch {
      setMessage(
        "Your device blocked sound. Try enabling alerts again after interacting with the page.",
      );
    }
  }
  async function test() {
    try {
      await primeAlertSound();
      await playAlertSound();
      setMessage(
        "Test alert played. Device volume and notification permissions control sound.",
      );
    } catch {
      setMessage(
        "Sound could not play. Check device volume and browser permissions.",
      );
    }
  }
  async function open() {
    if (!current) return;
    const alert = current;
    try {
      await request("/notifications/read", { id: alert.id });
      setCurrent(null);
      router.push(
        (notificationRoute(alert, state?.user.role) ||
          "/notifications") as never,
      );
    } catch {}
  }
  const banner =
    current &&
    (current.kind !== "partner_offer" ||
      state?.user.role === "professional") ? (
      <View
        accessibilityRole="alert"
        style={{
          backgroundColor: c.forest,
          borderRadius: 18,
          padding: 18,
          gap: 10,
          borderWidth: 1,
          borderColor: c.gold,
        }}
      >
        <Badge label="New update" />
        <T color={c.white} bold size={19}>
          {current.title}
        </T>
        <T color={c.white}>{current.body}</T>
        <Row>
          <Button
            label={
              current.kind === "partner_offer"
                ? "Review partner offers"
                : current.bookingId
                  ? "View booking alert"
                  : "View notification"
            }
            secondary
            onPress={() => void open()}
          />
          <Button
            label="Dismiss alert"
            secondary
            onPress={() => setCurrent(null)}
          />
        </Row>
      </View>
    ) : null;
  return (
    <Context.Provider value={{ enabled, toggle, test, message, banner }}>
      {children}
    </Context.Provider>
  );
}

export function BookingAlertBanner() {
  return <>{useBookingAlerts().banner}</>;
}
