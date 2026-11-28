// Customer home building blocks: live booking tracking, quick rating, trust
// signals, offers, one-tap rebooking and sharing.
import React, { useEffect, useState } from "react";
import { View, Pressable, ScrollView } from "react-native";
import { router } from "expo-router";
import { useApp } from "../lib/context";
import {
  money,
  dateLabel,
  statusLabel,
  type AppState,
  type Booking,
} from "../lib/model";
import { T, c, Row, Icon } from "./ui";
import { ServicePhoto } from "./ServicePhoto";
import { OfferTicket } from "./OffersManager";
import { shareMessage, WEBSITE_URL } from "../lib/share";

const go = (href: string) => router.push(href as never);

export function greetingFor(now: number) {
  const hour = new Date(now + 330 * 60000).getUTCHours();
  return hour < 12
    ? "Good morning"
    : hour < 17
      ? "Good afternoon"
      : "Good evening";
}

const progressSteps = [
  "Booked",
  "Professional assigned",
  "Service started",
  "Completed",
];
export function progressIndex(b: Booking) {
  if (b.status === "completed") return 3;
  if (b.status === "in_progress") return 2;
  // A paid booking still waiting for a professional has completed "Booked".
  if (["assigned", "confirmed", "awaiting_assignment"].includes(b.status))
    return 1;
  return 0;
}

/** Four-step visit tracker. `dark` is for the forest-green home card. */
export function BookingProgress({
  booking,
  dark = false,
}: {
  booking: Booking;
  dark?: boolean;
}) {
  const { t } = useApp();
  if (
    booking.fulfillmentType === "laundry" ||
    ["cancelled", "payment_expired"].includes(booking.status)
  )
    return null;
  const current = progressIndex(booking);
  const waiting = ["payment_pending", "awaiting_assignment"].includes(
    booking.status,
  );
  const on = dark ? c.gold : c.green,
    off = dark ? "#2E5A4E" : c.line;
  return (
    <View
      accessible
      accessibilityLabel={
        t("Visit progress") +
        ": " +
        t(progressSteps[current]) +
        (waiting ? ", " + t(statusLabel(booking.status)) : "")
      }
      style={{ gap: 8 }}
    >
      <Row style={{ gap: 6 }}>
        {progressSteps.map((label, i) => (
          <View
            key={label}
            style={{
              flex: 1,
              height: 6,
              borderRadius: 3,
              backgroundColor:
                i < current || (i === current && !waiting)
                  ? on
                  : i === current
                    ? dark
                      ? "#8C7A55"
                      : "#E8D3A6"
                    : off,
            }}
          />
        ))}
      </Row>
      <Row style={{ justifyContent: "space-between" }}>
        {progressSteps.map((label, i) => (
          <T
            key={label}
            size={9}
            bold={i === current}
            color={
              dark
                ? i <= current
                  ? c.white
                  : "#7FA597"
                : i <= current
                  ? c.green
                  : c.muted
            }
            style={{
              flex: 1,
              textAlign: i === 0 ? "left" : i === 3 ? "right" : "center",
            }}
          >
            {label}
          </T>
        ))}
      </Row>
    </View>
  );
}

export function LiveBookingCard({ booking }: { booking: Booking }) {
  const { lang, t } = useApp();
  const pay = booking.status === "payment_pending";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="View next booking"
      onPress={() => go("/booking/" + booking.id)}
      style={({ pressed }) => ({
        borderRadius: 22,
        padding: 18,
        gap: 12,
        backgroundColor: c.forest,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <Row style={{ justifyContent: "space-between" }}>
        <T size={11} color={c.gold} bold style={{ letterSpacing: 1 }}>
          YOUR NEXT SERVICE
        </T>
        <View
          style={{
            backgroundColor: pay ? c.amberbg : "#205045",
            borderRadius: 12,
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}
        >
          <T size={10} bold color={pay ? c.amber : c.white}>
            {statusLabel(booking.status)}
          </T>
        </View>
      </Row>
      <View style={{ gap: 2 }}>
        <T bold size={19} color={c.white}>
          {booking.serviceName}
        </T>
        <T size={12} color="#B7CEC4">
          {dateLabel(booking.slot, lang)}
        </T>
      </View>
      <BookingProgress booking={booking} dark />
      <Row style={{ justifyContent: "space-between" }}>
        <T size={12} color="#B7CEC4" style={{ flex: 1 }}>
          {pay
            ? t("Complete payment to confirm your slot.")
            : booking.professionalName
              ? booking.professionalName + " · " + t("ANVIRA verified")
              : t("We will share your professional’s details here.")}
        </T>
        <Row style={{ gap: 4 }}>
          <T bold size={12} color={c.gold}>
            {pay ? "Pay now" : "Track"}
          </T>
          <Icon name="next" size={14} color={c.gold} />
        </Row>
      </Row>
    </Pressable>
  );
}

/** Quick 1–5 star prompt for a recent visit that has not been rated. */
export function RatePrompt({ booking }: { booking: Booking }) {
  const { t } = useApp();
  return (
    <View
      style={{
        backgroundColor: c.white,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: c.line,
        padding: 16,
        gap: 8,
      }}
    >
      <T bold size={15}>
        Rate your recent visit
      </T>
      <T size={12} color={c.muted}>
        {t(booking.serviceName) +
          " · " +
          t("Tap a star. It helps us keep quality high.")}
      </T>
      <Row style={{ gap: 4 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            accessibilityRole="button"
            accessibilityLabel={
              t("Rate") + " " + n + " " + t(n === 1 ? "star" : "stars")
            }
            onPress={() => go("/booking/" + booking.id + "?rate=" + n)}
            style={{ padding: 6, minWidth: 44, minHeight: 44 }}
          >
            <Icon name="star" size={28} color={c.gold} />
          </Pressable>
        ))}
      </Row>
    </View>
  );
}

const trust: [string, string][] = [
  ["shield", "Verified professionals"],
  ["wallet", "Upfront prices"],
  ["check", "Secure payments"],
  ["refresh", "7-day service support"],
];
export function TrustStrip() {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8 }}
    >
      {trust.map(([icon, label]) => (
        <Row
          key={label}
          style={{
            gap: 6,
            backgroundColor: c.white,
            borderWidth: 1,
            borderColor: c.line,
            borderRadius: 14,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <Icon name={icon} size={15} />
          <T size={11} bold color={c.forest}>
            {label}
          </T>
        </Row>
      ))}
    </ScrollView>
  );
}

export function featuredOffers(state: AppState, now: number) {
  return state.promotions.filter(
    (p) =>
      p.active &&
      p.featured &&
      p.expiresAt > now &&
      (p.uses || 0) < p.maxUses,
  );
}

export function OffersForYou({ state, now }: { state: AppState; now: number }) {
  const offers = featuredOffers(state, now);
  if (!offers.length) return null;
  return (
    <View style={{ gap: 12 }}>
      <Row style={{ gap: 8 }}>
        <Icon name="gift" size={20} />
        <T bold size={19}>
          Offers for you
        </T>
      </Row>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12 }}
      >
        {offers.map((p) => (
          <View key={p.id} style={{ width: offers.length > 1 ? 300 : 340 }}>
            <OfferTicket
              code={p.id}
              title={p.title}
              discount={p.discountAmount}
              minimum={p.minAmount}
              expiresAt={p.expiresAt}
              action={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={"Book with offer " + p.id}
                  onPress={() => go("/services")}
                  style={{ minHeight: 32, justifyContent: "center" }}
                >
                  <T bold size={12} color={c.gold}>
                    Book now →
                  </T>
                </Pressable>
              }
            />
          </View>
        ))}
      </ScrollView>
      <T size={11} color="#7B877F">
        Apply the code at checkout. One offer per booking.
      </T>
    </View>
  );
}

export function BookAgain({ state }: { state: AppState }) {
  const { t, lang } = useApp();
  const seen = new Set<string>();
  const recent = state.bookings
    .filter((b) => b.status === "completed")
    .sort((a, b) => (b.completedAt || b.slot) - (a.completedAt || a.slot))
    .filter((b) => {
      if (seen.has(b.serviceId)) return false;
      seen.add(b.serviceId);
      return state.services.some((s) => s.id === b.serviceId && s.active);
    })
    .slice(0, 6);
  if (!recent.length) return null;
  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 2 }}>
        <T bold size={19}>
          Book again
        </T>
        <T size={12} color={c.muted}>
          Your past services, one tap away.
        </T>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12 }}
      >
        {recent.map((b) => {
          const service = state.services.find((s) => s.id === b.serviceId);
          return (
            <Pressable
              key={b.id}
              accessibilityRole="button"
              accessibilityLabel={t("Book again") + ": " + t(b.serviceName)}
              onPress={() => go("/service/" + b.serviceId)}
              style={({ pressed }) => ({
                width: 168,
                backgroundColor: c.white,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: c.line,
                overflow: "hidden",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <ServicePhoto service={service} style={{ width: "100%", height: 92 }} />
              <View style={{ padding: 12, gap: 4 }}>
                <T bold size={13} numberOfLines={1}>
                  {b.serviceName}
                </T>
                <T size={10} color={c.muted}>
                  {t("Last visit") +
                    " " +
                    new Date(b.completedAt || b.slot).toLocaleDateString(
                      lang === "te" ? "te-IN" : "en-IN",
                      { timeZone: "Asia/Kolkata", day: "numeric", month: "short" },
                    )}
                </T>
                <Row style={{ justifyContent: "space-between", marginTop: 4 }}>
                  <T bold size={12} color={c.green}>
                    {money(b.total)}
                  </T>
                  <Icon name="refresh" size={15} />
                </Row>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** Overall customer rating, shown only once enough reviews exist. */
export function RatingProof() {
  const { read, t } = useApp();
  const [rating, setRating] = useState<{
    count: number;
    average: number | null;
  } | null>(null);
  useEffect(() => {
    let current = true;
    void read<{ count: number; average: number | null }>("/public/ratings")
      .then((value) => current && setRating(value))
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [read]);
  if (!rating?.average || rating.count < 5 || rating.average < 4) return null;
  return (
    <Row
      style={{
        backgroundColor: c.white,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: c.line,
        padding: 16,
        gap: 14,
      }}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 18,
          backgroundColor: c.amberbg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <T bold size={20} color={c.amber}>
          {rating.average.toFixed(1)}
        </T>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Row style={{ gap: 2 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Icon
              key={n}
              name="star"
              size={14}
              color={n <= Math.round(rating.average!) ? c.gold : c.line}
            />
          ))}
        </Row>
        <T bold size={14}>
          Loved by ANVIRA customers
        </T>
        <T size={11} color={c.muted}>
          {rating.count + " " + t("reviews after completed visits")}
        </T>
      </View>
    </Row>
  );
}

export function inviteMessage(state: AppState, now: number) {
  const offer = featuredOffers(state, now)[0];
  const links = [
    state.settings.playStoreUrl && "Android: " + state.settings.playStoreUrl,
    state.settings.appStoreUrl && "iPhone: " + state.settings.appStoreUrl,
  ]
    .filter(Boolean)
    .join("\n");
  return (
    "I use ANVIRA for home services: verified professionals for cleaning, car care, AC, RO, plumbing and electrical work, with upfront prices." +
    (offer
      ? ` Use code ${offer.id} for ${money(offer.discountAmount)} off.`
      : "") +
    "\n" +
    (links || WEBSITE_URL)
  );
}

export function InviteCard({ state, now }: { state: AppState; now: number }) {
  const { t } = useApp();
  const [note, setNote] = useState("");
  return (
    <View
      style={{
        borderRadius: 22,
        padding: 18,
        gap: 10,
        backgroundColor: c.amberbg,
        borderWidth: 1,
        borderColor: "#F0DDB8",
      }}
    >
      <Row style={{ gap: 10 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: c.white,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="gift" size={22} color={c.amber} />
        </View>
        <View style={{ flex: 1 }}>
          <T bold size={16}>
            Know a home that needs a hand?
          </T>
          <T size={12} color={c.muted}>
            Share ANVIRA with family, friends and neighbours.
          </T>
        </View>
      </Row>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("Share ANVIRA")}
        onPress={async () => {
          const result = await shareMessage(inviteMessage(state, now));
          setNote(
            result === "copied"
              ? t("Invite message copied. Paste it anywhere.")
              : result === "failed"
                ? t("Sharing is not available on this device.")
                : "",
          );
        }}
        style={({ pressed }) => ({
          flexDirection: "row",
          gap: 8,
          alignItems: "center",
          justifyContent: "center",
          minHeight: 48,
          borderRadius: 14,
          backgroundColor: c.forest,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Icon name="share" size={18} color={c.white} />
        <T bold color={c.white}>
          Share ANVIRA
        </T>
      </Pressable>
      {!!note && (
        <T size={12} color={c.amber} accessibilityLiveRegion="polite">
          {note}
        </T>
      )}
    </View>
  );
}
