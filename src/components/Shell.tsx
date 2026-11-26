import BrandLogo from "./BrandLogo";
import AdminFrame from "./AdminFrame";
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
  KeyboardAvoidingView,
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
import { staffNavigation } from "../lib/office-ui";
import { T, c, Row, Icon } from "./ui";
export function Shell({
  title,
  back = false,
  children,
  footer,
  onBack,
  scrollKey,
}: {
  title?: string;
  back?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onBack?: () => void;
  scrollKey?: string | number;
}) {
  const focused = useIsFocused();
  const {
      state,
      selectedAddress,
      initializing,
      error,
      clearError,
      reauthRequired,
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
          ["/support", "Help", "phone"],
          ["/profile", "Profile", "person"],
        ];
  const menus = staffNavigation(state.user.role, Platform.OS);
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
        path === "/cart" ||
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
  if (admin && Platform.OS === "web")
    return (
      <AdminFrame title={title} back={back} onBack={onBack} footer={footer}>
        {children}
      </AdminFrame>
    );
  const activeTab = (href: string) =>
    path === href ||
    (href === "/bookings" && path.startsWith("/booking/")) ||
    (href === "/home" && ["/services", "/care", "/cart"].includes(path)) ||
    (href === "/profile" &&
      [
        "/account",
        "/addresses",
        "/notifications",
        "/quotes",
        "/partner",
      ].includes(path));
  const nav = (
    <Row style={{ justifyContent: "space-around", minHeight: 68, gap: 0 }}>
      {tabs.map(([href, label, icon]) => (
        <Pressable
          key={href}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab(href) }}
          accessibilityLabel={t(label)}
          onPress={() => {
            if (path !== href) router.navigate(href as never);
          }}
          style={{
            alignItems: "center",
            gap: 4,
            paddingVertical: 8,
            flex: 1,
            minHeight: 44,
            borderRadius: 16,
            backgroundColor: "transparent",
          }}
        >
          <View
            style={{
              paddingHorizontal: 18,
              paddingVertical: 4,
              borderRadius: 14,
              backgroundColor: activeTab(href) ? c.mint : "transparent",
            }}
          >
            <Icon
              name={icon}
              size={22}
              color={activeTab(href) ? c.green : c.muted}
            />
          </View>
          <T
            size={11}
            bold={activeTab(href)}
            color={activeTab(href) ? c.green : c.muted}
          >
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
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, flexDirection: desktop ? "row" : "column" }}
      >
        {desktop && (
          <View
            style={{
              width: 240,
              padding: 24,
              backgroundColor: c.forest,
              gap: 32,
            }}
          >
            <BrandLogo width={170} />
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
          <View
            style={{
              paddingHorizontal: desktop ? 40 : 20,
              paddingTop: 16,
              paddingBottom: 12,
              backgroundColor: c.white,
              borderBottomWidth: 1,
              borderBottomColor: c.line,
            }}
          >
            <Row style={{ justifyContent: "space-between", gap: 8 }}>
              {title ? (
                <Row style={{ flex: 1, minWidth: 0 }}>
                  {back && (
                    <Pressable
                      accessibilityLabel={t("Back")}
                      accessibilityRole="button"
                      onPress={
                        onBack ||
                        (() =>
                          router.canGoBack()
                            ? router.back()
                            : navigate(
                                admin
                                  ? "/dashboard/home"
                                  : state.user.role === "professional"
                                    ? "/jobs"
                                    : "/home",
                              ))
                      }
                      style={{
                        width: 44,
                        minHeight: 44,
                        justifyContent: "center",
                        alignItems: "center",
                        backgroundColor: c.soft,
                        borderRadius: 14,
                      }}
                    >
                      <Icon name="back" />
                    </Pressable>
                  )}
                  <T
                    size={desktop ? 28 : 20}
                    bold
                    numberOfLines={2}
                    style={{ flexShrink: 1 }}
                  >
                    {title}
                  </T>
                </Row>
              ) : (
                <View style={{ flex: 1, alignItems: "flex-start" }}>
                  <T
                    bold
                    size={15}
                    color={c.forest}
                    style={{ letterSpacing: 2 }}
                  >
                    ANVIRA
                  </T>
                  {state.user.role === "customer" && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Change service address"
                      onPress={() => navigate("/addresses")}
                      style={{
                        minHeight: 32,
                        justifyContent: "center",
                        maxWidth: "100%",
                      }}
                    >
                      <Row style={{ gap: 4 }}>
                        <Icon name="home" size={14} />
                        <T
                          numberOfLines={1}
                          size={12}
                          color={c.green}
                          style={{ flexShrink: 1 }}
                        >
                          {selectedAddress
                            ? selectedAddress.label +
                              " · " +
                              selectedAddress.pin
                            : "Choose service address"}
                        </T>
                        <Icon name="next" size={14} />
                      </Row>
                    </Pressable>
                  )}
                </View>
              )}
              <Row style={{ gap: 4 }}>
                {!!admin && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("Refresh updates")}
                    onPress={() => void refresh()}
                    style={{ padding: 10 }}
                  >
                    <Icon name="refresh" />
                  </Pressable>
                )}
                {
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("Notifications")}
                    onPress={() => navigate("/notifications")}
                    style={{
                      padding: 11,
                      borderRadius: 16,
                      minWidth: 44,
                      minHeight: 44,
                      backgroundColor: c.soft,
                      alignItems: "center",
                      position: "relative",
                    }}
                  >
                    <Icon name="bell" />
                    {!!state.notifications.filter((n) => !n.read).length && (
                      <View
                        style={{
                          position: "absolute",
                          top: 5,
                          right: 5,
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: c.green,
                          borderWidth: 1,
                          borderColor: c.white,
                        }}
                      />
                    )}
                  </Pressable>
                }
                {!title && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("Switch language")}
                    onPress={() => setLang(lang === "en" ? "te" : "en")}
                    style={{ padding: 10 }}
                  >
                    <T size={11} bold color={c.green}>
                      {lang === "en" ? "తెలుగు" : "English"}
                    </T>
                  </Pressable>
                )}
              </Row>
            </Row>
          </View>
          <ScrollView
            key={path + ":" + (scrollKey ?? "")}
            style={{ flex: 1, minHeight: 0 }}
            contentContainerStyle={{
              padding: desktop ? 40 : 20,
              paddingBottom: 28,
              gap: 22,
            }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
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
            {!!error && (
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
                {reauthRequired && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={logout}
                    style={{ minHeight: 44, justifyContent: "center" }}
                  >
                    <T color={c.red} bold>
                      Sign in again
                    </T>
                  </Pressable>
                )}
                <Pressable
                  accessibilityRole="button"
                  onPress={clearError}
                  style={{ minHeight: 44, justifyContent: "center" }}
                >
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
                backgroundColor: c.white,
                borderTopWidth: 1,
                borderTopColor: c.line,
                paddingHorizontal: 20,
                paddingVertical: 14,
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
          {process.env.EXPO_PUBLIC_RELEASE_CHANNEL !== "staging" &&
            (state.mode === "demo" ||
              state.features?.paymentEnvironment === "test") && (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  top: 0,
                  right: desktop ? 40 : 24,
                }}
              >
                <T size={8} color={c.muted}>
                  {state.mode === "demo"
                    ? "DEMO · SAMPLE SERVICES"
                    : "PAYMENT TEST MODE · NO REAL CHARGES"}
                </T>
              </View>
            )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
function BadgeRole() {
  const { state } = useApp();
  return (
    <View style={{ backgroundColor: c.green, padding: 12, borderRadius: 12 }}>
      <T color={c.white} size={12}>
        {state?.user.role === "owner" ? "Admin / Owner" : "Customer Associate"}
      </T>
    </View>
  );
}
const s = StyleSheet.create({
  nav: {
    borderTopWidth: 1,
    borderColor: c.line,
    backgroundColor: c.white,
    paddingHorizontal: 8,
  },
});
