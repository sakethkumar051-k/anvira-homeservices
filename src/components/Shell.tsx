import React, { useEffect, useState } from "react";
import {
  View,
  ScrollView,
  Pressable,
  useWindowDimensions,
  Platform,
  StyleSheet,
  AccessibilityInfo,
  AppState,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, usePathname, useIsFocused } from "expo-router";
import {
  GlassView,
  isLiquidGlassAvailable,
  isGlassEffectAPIAvailable,
} from "expo-glass-effect";
import { BlurView } from "expo-blur";
import { useApp } from "../lib/context";
import { BookingAlertBanner } from "./BookingAlerts";
import { T, c, Row, Icon } from "./ui";
const ownerTabs = [
  ["home", "Overview", "grid"],
  ["bookings", "Bookings", "calendar"],
  ["vendors", "Professionals", "users"],
  ["services", "Services", "tool"],
  ["refunds", "Payments & refunds", "wallet"],
  ["support", "Customer support", "phone"],
  ["reports", "Reports", "chart"],
  ["settings", "Roles & settings", "settings"],
  ["payouts", "Payouts & reconciliation", "wallet"],
  ["offers", "Offers", "spark"],
];
const careTabs = ownerTabs.filter((x) =>
  ["home", "bookings", "refunds", "support"].includes(x[0]),
);
export function Shell({
  title,
  back = false,
  children,
  footer,
}: {
  title?: string;
  back?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const focused = useIsFocused();
  const {
      state,
      initializing,
      error,
      clearError,
      refresh,
      logout,
      lang,
      setLang,
      t,
    } = useApp(),
    path = usePathname(),
    { width } = useWindowDimensions();
  const [reduceTransparency, setReduceTransparency] = useState(true);
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    void AccessibilityInfo.isReduceTransparencyEnabled().then(
      setReduceTransparency,
    );
    const sub = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setReduceTransparency,
    );
    return () => sub.remove();
  }, []);
  const admin = state && ["owner", "care"].includes(state.user.role),
    desktop = !!admin && width >= 950;
  useEffect(() => {
    if (focused && !state && !initializing) router.replace("/");
  }, [state, focused, initializing]);
  useEffect(() => {
    if (!focused) return;
    void refresh();
    const timer = setInterval(() => {
      if (
        AppState.currentState === "active" &&
        (Platform.OS !== "web" || !document.hidden)
      )
        void refresh();
    }, 30000);
    const sub = AppState.addEventListener("change", (status) => {
      if (status === "active") void refresh();
    });
    const focus = () => void refresh();
    if (Platform.OS === "web") window.addEventListener("focus", focus);
    return () => {
      clearInterval(timer);
      sub.remove();
      if (Platform.OS === "web") window.removeEventListener("focus", focus);
    };
  }, [refresh, focused]);
  if (!state) return null;
  const tabs =
    state.user.role === "professional"
      ? [
          ["/jobs", "Jobs", "tool"],
          ["/earnings", "Earnings", "wallet"],
          ["/profile", "Profile", "person"],
        ]
      : [
          ["/home", "Home", "home"],
          ["/bookings", "Bookings", "calendar"],
          ["/profile", "Profile", "person"],
        ];
  const menus = state.user.role === "owner" ? ownerTabs : careTabs;
  const navigate = (href: string) => router.push(href as never);
  const restricted =
    (state.user.role === "customer" &&
      (path.startsWith("/dashboard") ||
        path === "/jobs" ||
        path === "/earnings")) ||
    (state.user.role === "professional" &&
      (path.startsWith("/dashboard") ||
        path === "/home" ||
        path === "/services" ||
        path.startsWith("/service/") ||
        path.startsWith("/checkout/")));
  if (restricted)
    return (
      <SafeAreaView style={{ flex: 1, padding: 24, gap: 24 }}>
        <T bold size={24}>
          Access restricted
        </T>
        <T>This screen is not available for your account.</T>
        <Pressable
          onPress={() =>
            navigate(state.user.role === "professional" ? "/jobs" : "/home")
          }
        >
          <T color={c.green}>Return to your workspace</T>
        </Pressable>
      </SafeAreaView>
    );
  const nav = (
    <Row style={{ justifyContent: "space-around", height: 76 }}>
      {tabs.map(([href, label, icon]) => (
        <Pressable
          key={href}
          accessibilityRole="tab"
          accessibilityState={{ selected: path === href }}
          accessibilityLabel={t(label)}
          onPress={() => navigate(href)}
          style={{
            alignItems: "center",
            gap: 4,
            paddingVertical: 8,
            minWidth: 80,
            borderRadius: 24,
            backgroundColor: path === href ? c.mint : "transparent",
          }}
        >
          <Icon name={icon} />
          <T size={10} bold color={c.green}>
            {label}
          </T>
        </Pressable>
      ))}
    </Row>
  );
  return (
    <SafeAreaView
      style={{
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
        backgroundColor: c.ivory,
      }}
    >
      <View style={{ flex: 1, flexDirection: desktop ? "row" : "column" }}>
        {desktop && (
          <View
            style={{
              width: 240,
              padding: 24,
              backgroundColor: c.forest,
              gap: 32,
            }}
          >
            <View>
              <T color={c.white} size={22} bold>
                ANVIRA
              </T>
              <T color={c.gold} size={11}>
                HOME SERVICES
              </T>
            </View>
            <BadgeRole />
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 8 }}>
              {menus.map(([key, label, icon]) => (
                <Pressable
                  key={key}
                  onPress={() => navigate("/dashboard/" + key)}
                  style={{
                    padding: 14,
                    borderRadius: 14,
                    backgroundColor: path.endsWith("/" + key)
                      ? c.green
                      : "transparent",
                  }}
                >
                  <Row>
                    <Icon name={icon} color={c.white} />
                    <T color={c.white} size={13}>
                      {label}
                    </T>
                  </Row>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              onPress={() => {
                logout();
                router.replace("/");
              }}
            >
              <T color={c.white}>Sign out</T>
            </Pressable>
          </View>
        )}
        <View
          style={{
            flex: 1,
            width: "100%",
            maxWidth: admin ? 1600 : 480,
            alignSelf: desktop ? "stretch" : "center",
            minHeight: 0,
            minWidth: 0,
          }}
        >
          <ScrollView
            key={path}
            style={{ flex: 1, minHeight: 0 }}
            contentContainerStyle={{
              padding: desktop ? 40 : 24,
              paddingBottom: footer ? 130 : admin ? 40 : 130,
              gap: 24,
            }}
            keyboardShouldPersistTaps="handled"
          >
            <Row style={{ justifyContent: "space-between" }}>
              {title ? (
                <Row style={{ flex: 1 }}>
                  {back && (
                    <Pressable
                      accessibilityLabel="Back"
                      accessibilityRole="button"
                      onPress={() =>
                        router.canGoBack()
                          ? router.back()
                          : navigate(
                              admin
                                ? "/dashboard/home"
                                : state.user.role === "professional"
                                  ? "/jobs"
                                  : "/home",
                            )
                      }
                      style={{ padding: 8 }}
                    >
                      <Icon name="back" />
                    </Pressable>
                  )}
                  <T size={desktop ? 28 : 22} bold>
                    {title}
                  </T>
                </Row>
              ) : (
                <View>
                  <T size={16} bold color={c.green}>
                    ANVIRA
                  </T>
                  <T size={11} color={c.muted}>
                    Shadnagar · Home
                  </T>
                </View>
              )}
              <Row>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Refresh updates"
                  onPress={() => void refresh()}
                  style={{ padding: 10 }}
                >
                  <Icon name="refresh" />
                </Pressable>
                {
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Notifications"
                    onPress={() => navigate("/notifications")}
                    style={{
                      backgroundColor: c.white,
                      padding: 12,
                      borderRadius: 24,
                    }}
                  >
                    <Icon name="bell" />
                    {!!state.notifications.filter((n) => !n.read).length && (
                      <T size={10} bold color={c.green}>
                        {state.notifications.filter((n) => !n.read).length}
                      </T>
                    )}
                  </Pressable>
                }
                <Pressable
                  accessibilityLabel="Switch language"
                  onPress={() => setLang(lang === "en" ? "te" : "en")}
                  style={{ padding: 10 }}
                >
                  <T size={11} bold color={c.green}>
                    {lang === "en" ? "తెలుగు" : "English"}
                  </T>
                </Pressable>
              </Row>
            </Row>
            {admin && !desktop && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Row>
                  {menus.map(([key, label]) => (
                    <Pressable
                      key={key}
                      onPress={() => navigate("/dashboard/" + key)}
                      style={{
                        padding: 12,
                        borderRadius: 14,
                        backgroundColor: path.endsWith("/" + key)
                          ? c.mint
                          : c.white,
                      }}
                    >
                      <T>{label}</T>
                    </Pressable>
                  ))}
                </Row>
              </ScrollView>
            )}
            <BookingAlertBanner />
            {error && (
              <View
                accessibilityRole="alert"
                style={{
                  backgroundColor: c.redbg,
                  padding: 16,
                  borderRadius: 16,
                  gap: 8,
                }}
              >
                <T color={c.red}>{error}</T>
                <Pressable onPress={clearError}>
                  <T color={c.red} bold>
                    Dismiss
                  </T>
                </Pressable>
              </View>
            )}
            {children}
          </ScrollView>
          {footer ? (
            <View
              style={{
                position: "absolute",
                left: 24,
                right: 24,
                bottom: 24,
                backgroundColor: c.ivory,
                paddingTop: 12,
              }}
            >
              {footer}
            </View>
          ) : !admin ? (
            <View style={[s.nav, { overflow: "hidden" }]}>
              {Platform.OS === "ios" && !reduceTransparency ? (
                isLiquidGlassAvailable() && isGlassEffectAPIAvailable() ? (
                  <GlassView
                    glassEffectStyle="regular"
                    colorScheme="light"
                    style={{ borderRadius: 32 }}
                  >
                    {nav}
                  </GlassView>
                ) : (
                  <BlurView intensity={70} tint="light">
                    {nav}
                  </BlurView>
                )
              ) : (
                nav
              )}
            </View>
          ) : null}
          {(state.mode === "demo" ||
            state.features?.paymentEnvironment === "test") && (
            <View
              pointerEvents="none"
              style={{ position: "absolute", top: 0, right: desktop ? 40 : 24 }}
            >
              <T size={8} color={c.muted}>
                {state.mode === "demo"
                  ? "DEMO · SAMPLE SERVICES"
                  : "PAYMENT TEST MODE · NO REAL CHARGES"}
              </T>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
function BadgeRole() {
  const { state } = useApp();
  return (
    <View style={{ backgroundColor: c.green, padding: 12, borderRadius: 12 }}>
      <T color={c.white} size={12}>
        {state?.user.role === "owner" ? "Owner workspace" : "Customer Care"}
      </T>
    </View>
  );
}
const s = StyleSheet.create({
  nav: {
    position: "absolute",
    bottom: 20,
    left: 24,
    right: 24,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: "rgba(255,255,255,0.94)",
    boxShadow: "0 8px 30px rgba(7,63,50,.08)",
  },
});
