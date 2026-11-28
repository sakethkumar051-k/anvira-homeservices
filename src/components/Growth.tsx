// Owner growth toolkit: shareable links, a printable QR poster, ready-to-send
// messages and win-back insights drawn from recent bookings.
import React, { useEffect, useMemo, useState } from "react";
import { View, Platform, Pressable } from "react-native";
import { router } from "expo-router";
import { SvgXml } from "react-native-svg";
import QRCode from "qrcode";
import { useApp } from "../lib/context";
import { money, serviceDay, type Booking } from "../lib/model";
import { servicePriceText } from "./ServiceCatalog";
import { T, c, Card, Row, Button, Input, Badge, Icon } from "./ui";
import { StatTile } from "./Insights";
import { offerMessage } from "./OffersManager";
import { copyText, openWhatsApp, WEBSITE_URL } from "../lib/share";

const go = (href: string) => router.push(href as never);
const WIN_BACK_DAYS = 45;

function useQr(url: string) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let current = true;
    void QRCode.toString(url, {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#073F32", light: "#FFFFFF" },
    })
      .then((value) => current && setSvg(value))
      .catch(() => current && setSvg(""));
    return () => {
      current = false;
    };
  }, [url]);
  return svg;
}

export function customerInsights(bookings: Booking[], now: number) {
  const byCustomer = new Map<
    string,
    {
      id: string;
      name: string;
      completed: number;
      spent: number;
      last?: Booking;
      upcoming: boolean;
    }
  >();
  for (const b of bookings) {
    const entry = byCustomer.get(b.customerId) || {
      id: b.customerId,
      name: b.customerName,
      completed: 0,
      spent: 0,
      upcoming: false,
    };
    if (b.status === "completed") {
      entry.completed++;
      entry.spent += b.total;
      if (!entry.last || (b.completedAt || b.slot) > (entry.last.completedAt || entry.last.slot))
        entry.last = b;
    }
    if (
      ["assigned", "confirmed", "awaiting_assignment", "in_progress"].includes(
        b.status,
      )
    )
      entry.upcoming = true;
    byCustomer.set(b.customerId, entry);
  }
  const customers = [...byCustomer.values()].filter((x) => x.completed);
  const repeat = customers.filter((x) => x.completed > 1).length;
  const winBack = customers
    .filter(
      (x) =>
        !x.upcoming &&
        x.last &&
        now - (x.last.completedAt || x.last.slot) > WIN_BACK_DAYS * 86400000,
    )
    .map((x) => ({
      ...x,
      days: Math.floor((now - (x.last!.completedAt || x.last!.slot)) / 86400000),
    }))
    .sort((a, b) => b.spent - a.spent);
  const reviews = bookings.filter((b) => b.review?.rating);
  return {
    customers: customers.length,
    repeatRate: customers.length
      ? Math.round((repeat / customers.length) * 100)
      : 0,
    top: [...customers].sort((a, b) => b.spent - a.spent).slice(0, 5),
    winBack,
    reviews: reviews.length,
    rating: reviews.length
      ? Math.round(
          (reviews.reduce((sum, b) => sum + (b.review?.rating || 0), 0) /
            reviews.length) *
            10,
        ) / 10
      : null,
  };
}

function MessageCard({
  title,
  message,
  onNotice,
}: {
  title: string;
  message: string;
  onNotice: (text: string) => void;
}) {
  const { t } = useApp();
  return (
    <Card style={{ flexGrow: 1, flexBasis: 320 }}>
      <Row style={{ justifyContent: "space-between" }}>
        <T bold>{title}</T>
        <Icon name="chat" size={18} />
      </Row>
      <View
        style={{
          backgroundColor: "#E7F6DE",
          borderRadius: 14,
          borderTopLeftRadius: 4,
          padding: 12,
        }}
      >
        <T size={12} selectable>
          {message}
        </T>
      </View>
      <Row>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Copy message") + ": " + t(title)}
          onPress={async () =>
            onNotice(
              t(
                (await copyText(message))
                  ? "Message copied."
                  : "Copy is blocked in this browser. Select the message and copy it manually.",
              ),
            )
          }
          style={({ pressed }) => ({
            flex: 1,
            minHeight: 46,
            borderRadius: 14,
            backgroundColor: c.mint,
            flexDirection: "row",
            gap: 8,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Icon name="copy" size={16} />
          <T bold size={13} color={c.green}>
            Copy
          </T>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Send on WhatsApp") + ": " + t(title)}
          onPress={() => void openWhatsApp(message)}
          style={({ pressed }) => ({
            flex: 1,
            minHeight: 46,
            borderRadius: 14,
            backgroundColor: c.green,
            flexDirection: "row",
            gap: 8,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Icon name="chat" size={16} color={c.white} />
          <T bold size={13} color={c.white}>
            WhatsApp
          </T>
        </Pressable>
      </Row>
    </Card>
  );
}

export function Growth() {
  const { state, request, busy, t } = useApp();
  const [now] = useState(() => Date.now());
  const [notice, setNotice] = useState("");
  const [appStore, setAppStore] = useState(state?.settings.appStoreUrl || "");
  const [playStore, setPlayStore] = useState(
    state?.settings.playStoreUrl || "",
  );
  const [linkError, setLinkError] = useState("");
  const [target, setTarget] = useState<"website" | "ios" | "android">(
    "website",
  );
  const insights = useMemo(
    () => customerInsights(state?.bookings || [], now),
    [state?.bookings, now],
  );
  const targetUrl =
    target === "ios" && state?.settings.appStoreUrl
      ? state.settings.appStoreUrl
      : target === "android" && state?.settings.playStoreUrl
        ? state.settings.playStoreUrl
        : WEBSITE_URL;
  const qr = useQr(targetUrl);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const style = document.createElement("style");
    style.textContent =
      "@media print{@page{size:A4;margin:0}body *{visibility:hidden!important}#anvira-poster,#anvira-poster *{visibility:visible!important}#anvira-poster{position:fixed!important;inset:0!important;width:100%!important;height:100%!important;border-radius:0!important;border:0!important}}";
    document.head.appendChild(style);
    return () => style.remove();
  }, []);
  if (!state) return null;
  const services = state.services
    .filter((s) => s.active && s.status !== "paused" && s.status !== "draft")
    .slice(0, 6);
  const offer = state.promotions.find(
    (p) =>
      p.active &&
      p.featured &&
      p.expiresAt > now &&
      (p.uses || 0) < p.maxUses,
  );
  const phone = state.settings.supportPhone || "";
  const links = [
    ["Website", WEBSITE_URL],
    ["App Store", state.settings.appStoreUrl || ""],
    ["Google Play", state.settings.playStoreUrl || ""],
  ].filter(([, url]) => url);
  const appLine = [
    state.settings.playStoreUrl && "Android: " + state.settings.playStoreUrl,
    state.settings.appStoreUrl && "iPhone: " + state.settings.appStoreUrl,
  ]
    .filter(Boolean)
    .join("\n");
  const messages = [
    {
      title: "Introduce ANVIRA",
      message:
        "Hi! ANVIRA brings verified professionals home for cleaning, car care, AC service, RO service, plumbing and electrical work. Upfront prices, secure payment and support if anything goes wrong.\n" +
        (appLine || "Book here: " + WEBSITE_URL),
    },
    ...services
      .filter((s) => s.billingPeriod !== "monthly" && s.bookingMode !== "quote")
      .slice(0, 3)
      .map((s) => {
        const headline = (s.headline || "").trim();
        return {
          title: s.name,
          message:
            `${s.name} at your doorstep, ${servicePriceText(s).toLowerCase()}.` +
            (headline ? " " + headline.replace(/[.!]?$/, ".") : "") +
            "\nVerified ANVIRA professionals, upfront prices and secure payment.\n" +
            (appLine || "Book here: " + WEBSITE_URL),
        };
      }),
    {
      title: "Ask for a review",
      message:
        "Thank you for choosing ANVIRA! If you were happy with your visit, please rate it in the app under Bookings. It takes ten seconds and helps other families find us.",
    },
    ...(offer ? [{ title: "Share your live offer", message: offerMessage(offer) }] : []),
  ];
  return (
    <>
      <Row style={{ flexWrap: "wrap", alignItems: "stretch" }}>
        <StatTile
          label="Customers served"
          value={String(insights.customers)}
          icon="users"
          tone="forest"
        >
          <T size={11} color="#B7CEC4">
            From the latest 200 bookings
          </T>
        </StatTile>
        <StatTile
          label="Repeat customers"
          value={insights.repeatRate + "%"}
          icon="refresh"
        >
          <T size={11} color={c.muted}>
            Booked more than once
          </T>
        </StatTile>
        <StatTile
          label="Customer rating"
          value={insights.rating === null ? "—" : insights.rating.toFixed(1) + " ★"}
          icon="star"
        >
          <T size={11} color={c.muted}>
            {insights.reviews + " " + t("reviews collected")}
          </T>
        </StatTile>
        <StatTile
          label="Ready to win back"
          value={String(insights.winBack.length)}
          icon="gift"
        >
          <T size={11} color={c.muted}>
            {t("No visit in") + " " + WIN_BACK_DAYS + "+ " + t("days")}
          </T>
        </StatTile>
      </Row>
      {!!notice && (
        <T color={c.green} accessibilityLiveRegion="polite">
          {notice}
        </T>
      )}
      <View
        style={{
          flexDirection: Platform.OS === "web" ? "row" : "column",
          gap: 20,
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        <Card style={{ flex: 1, minWidth: 320 }}>
          <T bold size={19}>
            Printable shop poster
          </T>
          <T size={12} color={c.muted}>
            Print it for apartment notice boards, shops and service vans.
            Customers scan the code to reach you.
          </T>
          <Row style={{ flexWrap: "wrap", gap: 8 }}>
            {(
              [
                ["website", "Website", true],
                ["ios", "App Store", !!state.settings.appStoreUrl],
                ["android", "Google Play", !!state.settings.playStoreUrl],
              ] as const
            ).map(([key, label, available]) => (
              <Pressable
                key={key}
                accessibilityRole="radio"
                accessibilityState={{ checked: target === key, disabled: !available }}
                accessibilityLabel={t("QR code opens") + " " + t(label)}
                disabled={!available}
                onPress={() => setTarget(key)}
                style={{
                  paddingHorizontal: 14,
                  minHeight: 40,
                  justifyContent: "center",
                  borderRadius: 20,
                  backgroundColor: target === key ? c.green : c.soft,
                  opacity: available ? 1 : 0.45,
                }}
              >
                <T size={12} bold color={target === key ? c.white : c.ink}>
                  {label}
                </T>
              </Pressable>
            ))}
          </Row>
          <View
            nativeID="anvira-poster"
            style={{
              backgroundColor: c.forest,
              borderRadius: 24,
              padding: 28,
              gap: 16,
              alignSelf: "center",
              width: "100%",
              maxWidth: 460,
              aspectRatio: 1 / 1.414,
            }}
          >
            <T bold size={14} color={c.gold} style={{ letterSpacing: 6 }}>
              ANVIRA
            </T>
            <T bold size={30} color={c.white} style={{ letterSpacing: -1, lineHeight: 34 }}>
              Trusted home services, booked in a minute.
            </T>
            <View style={{ gap: 6 }}>
              {services.map((s) => (
                <Row key={s.id} style={{ gap: 8 }}>
                  <Icon name="check" size={14} color={c.gold} />
                  <T size={13} color={c.white} style={{ flex: 1 }}>
                    {s.name}
                  </T>
                  <T size={12} color="#B7CEC4">
                    {servicePriceText(s)}
                  </T>
                </Row>
              ))}
            </View>
            <Row style={{ flexWrap: "wrap", gap: 6 }}>
              {[
                "Verified professionals",
                "Upfront prices",
                "Secure payments",
                "7-day service support",
              ].map((label) => (
                <View
                  key={label}
                  style={{
                    borderWidth: 1,
                    borderColor: "#2E5A4E",
                    borderRadius: 12,
                    paddingHorizontal: 9,
                    paddingVertical: 4,
                  }}
                >
                  <T size={10} bold color={c.gold}>
                    {label}
                  </T>
                </View>
              ))}
            </Row>
            {offer && (
              <View
                style={{
                  backgroundColor: c.gold,
                  borderRadius: 12,
                  padding: 10,
                }}
              >
                <T bold size={13} color={c.forest}>
                  {money(offer.discountAmount) +
                    " " +
                    t("off with code") +
                    " " +
                    offer.id}
                </T>
              </View>
            )}
            <Row style={{ marginTop: "auto", alignItems: "flex-end", gap: 16 }}>
              <View
                style={{
                  backgroundColor: c.white,
                  padding: 8,
                  borderRadius: 14,
                  width: 128,
                  height: 128,
                }}
                accessible
                accessibilityLabel={t("QR code for") + " " + targetUrl}
              >
                {!!qr && <SvgXml xml={qr} width="100%" height="100%" />}
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <T bold size={13} color={c.white}>
                  Scan to book
                </T>
                <T size={11} color="#B7CEC4">
                  {targetUrl.replace(/^https:\/\//, "")}
                </T>
                {!!phone && (
                  <T bold size={13} color={c.gold}>
                    {"Call / WhatsApp " + phone.replace(/^\+91/, "+91 ")}
                  </T>
                )}
              </View>
            </Row>
          </View>
          {Platform.OS === "web" && (
            <Button label="Print poster" onPress={() => window.print()} />
          )}
        </Card>
        <View style={{ flex: 1, minWidth: 320, gap: 20 }}>
          <Card>
            <T bold size={19}>
              Your links
            </T>
            {links.map(([label, url]) => (
              <Row key={label} style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                <View style={{ flex: 1, minWidth: 180 }}>
                  <T bold size={13}>
                    {label}
                  </T>
                  <T size={12} color={c.muted} selectable numberOfLines={1}>
                    {url}
                  </T>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("Copy link") + ": " + t(label)}
                  onPress={async () =>
                    setNotice(
                      t(
                        (await copyText(url))
                          ? "Link copied."
                          : "Copy is blocked in this browser. Select the link and copy it manually.",
                      ),
                    )
                  }
                  style={{
                    flexDirection: "row",
                    gap: 6,
                    alignItems: "center",
                    paddingHorizontal: 12,
                    minHeight: 40,
                    borderRadius: 12,
                    backgroundColor: c.mint,
                  }}
                >
                  <Icon name="copy" size={16} />
                  <T bold size={12} color={c.green}>
                    Copy
                  </T>
                </Pressable>
              </Row>
            ))}
            <T size={12} color={c.muted}>
              Add the store links once the app is live. They then appear on
              the poster and in every message.
            </T>
            <Input
              label="App Store link"
              value={appStore}
              onChangeText={setAppStore}
              placeholder="https://apps.apple.com/in/app/…"
              autoCapitalize="none"
            />
            <Input
              label="Google Play link"
              value={playStore}
              onChangeText={setPlayStore}
              placeholder="https://play.google.com/store/apps/details?id=com.anvira.services"
              autoCapitalize="none"
            />
            <Button
              label="Save store links"
              secondary
              loading={busy}
              onPress={() => {
                const ios = appStore.trim(),
                  android = playStore.trim();
                if (ios && !ios.startsWith("https://apps.apple.com/"))
                  return setLinkError(
                    "App Store links start with https://apps.apple.com/",
                  );
                if (android && !android.startsWith("https://play.google.com/"))
                  return setLinkError(
                    "Google Play links start with https://play.google.com/",
                  );
                setLinkError("");
                void request(
                  "/settings",
                  { ...state.settings, appStoreUrl: ios, playStoreUrl: android },
                  "PUT",
                )
                  .then(() => setNotice(t("Store links saved.")))
                  .catch((e) => setLinkError((e as Error).message));
              }}
            />
            {!!linkError && (
              <T color={c.red} accessibilityRole="alert">
                {linkError}
              </T>
            )}
          </Card>
          <Card>
            <Row style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
              <T bold size={19}>
                Customers to win back
              </T>
              <Badge label={String(insights.winBack.length)} tone="amber" />
            </Row>
            <T size={12} color={c.muted}>
              {t("Past customers with no visit in") +
                " " +
                WIN_BACK_DAYS +
                "+ " +
                t("days and nothing booked. A small offer often brings them back.")}
            </T>
            {insights.winBack.slice(0, 6).map((x) => (
              <Row
                key={x.id}
                style={{
                  borderTopWidth: 1,
                  borderTopColor: c.line,
                  paddingTop: 10,
                }}
              >
                <View style={{ flex: 1 }}>
                  <T bold size={13}>
                    {x.name}
                  </T>
                  <T size={11} color={c.muted}>
                    {(x.last?.serviceName || "") +
                      " · " +
                      x.days +
                      " " +
                      t("days ago") +
                      " · " +
                      x.completed +
                      " " +
                      t(x.completed === 1 ? "visit" : "visits")}
                  </T>
                </View>
                <T bold size={13} color={c.green}>
                  {money(x.spent)}
                </T>
              </Row>
            ))}
            {!insights.winBack.length && (
              <T color={c.muted}>
                Nobody is overdue right now. Customers appear here when they
                have not booked for a while.
              </T>
            )}
            <Button
              label="Create a win-back offer"
              onPress={() => go("/dashboard/offers?template=comeback")}
            />
          </Card>
          <Card>
            <T bold size={19}>
              Top customers
            </T>
            {insights.top.map((x, i) => (
              <Row key={x.id}>
                <T bold size={13} color={c.muted} style={{ width: 20 }}>
                  {String(i + 1)}
                </T>
                <T bold size={13} style={{ flex: 1 }}>
                  {x.name}
                </T>
                <T size={12} color={c.muted}>
                  {x.completed + " " + t(x.completed === 1 ? "visit" : "visits")}
                </T>
                <T bold size={13} color={c.green}>
                  {money(x.spent)}
                </T>
              </Row>
            ))}
            {!insights.top.length && (
              <T color={c.muted}>Completed visits will rank customers here.</T>
            )}
          </Card>
        </View>
      </View>
      <View style={{ gap: 12 }}>
        <T bold size={19}>
          Ready-to-send messages
        </T>
        <T size={12} color={c.muted}>
          {"Copy a message or open WhatsApp with it filled in. Updated " +
            serviceDay(now) +
            " from your live services and offers."}
        </T>
        <Row style={{ flexWrap: "wrap", alignItems: "stretch" }}>
          {messages.map((m) => (
            <MessageCard
              key={m.title}
              title={m.title}
              message={m.message}
              onNotice={setNotice}
            />
          ))}
        </Row>
      </View>
    </>
  );
}
