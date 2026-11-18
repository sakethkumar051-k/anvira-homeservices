import { useEffect, useState } from "react";
import { AppState as DeviceState, Platform, View } from "react-native";
import { router, useIsFocused } from "expo-router";
import { useApp } from "../lib/context";
import { Booking, PartnerOffer, dateLabel, money } from "../lib/model";
import { offerSecondsRemaining } from "../lib/dispatch";
import { Badge, Button, Card, Divider, Row, T, c } from "./ui";

export function PartnerOffers() {
  const { state } = useApp();
  if (state?.user.role !== "professional") return null;
  return <OfferInbox key={state.user.id} />;
}

function OfferInbox() {
  const { state, read, request, busy, lang } = useApp();
  const focused = useIsFocused();
  const [offers, setOffers] = useState<PartnerOffer[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState("");
  const profile = state?.professionals.find((p) => p.id === state.user.id);
  useEffect(() => {
    if (!focused) return;
    let active = true,
      inFlight = false;
    const foreground = () =>
      Platform.OS === "web"
        ? typeof document !== "undefined" &&
          document.visibilityState !== "hidden"
        : DeviceState.currentState === "active";
    async function load() {
      if (!active || inFlight) return;
      inFlight = true;
      try {
        const data = await read<{ offers: PartnerOffer[] }>("/partner-offers");
        if (active) {
          setOffers(data.offers);
          setError("");
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        inFlight = false;
        if (active) setLoading(false);
      }
    }
    void load();
    const poll = setInterval(() => {
      if (foreground()) void load();
    }, 7000);
    const tick = setInterval(() => {
      if (foreground()) setNow(Date.now());
    }, 1000);
    const change = DeviceState.addEventListener("change", (value) => {
      if (value === "active") {
        setNow(Date.now());
        void load();
      }
    });
    const visible = () => {
      if (foreground()) {
        setNow(Date.now());
        void load();
      }
    };
    if (Platform.OS === "web")
      document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      clearInterval(poll);
      clearInterval(tick);
      change.remove();
      if (Platform.OS === "web")
        document.removeEventListener("visibilitychange", visible);
    };
  }, [read, state?.user.id, focused, attempt]);

  async function respond(offer: PartnerOffer, action: "accept" | "decline") {
    if (pending || !offerSecondsRemaining(offer.expiresAt)) return;
    setPending(offer.id);
    setError("");
    setMessage("");
    try {
      const result = await request<Booking | { ok: true }>(
        "/partner-offers/" + encodeURIComponent(offer.id) + "/" + action,
        {},
      );
      setOffers((items) => items.filter((item) => item.id !== offer.id));
      if (action === "accept" && "id" in result)
        router.push(("/booking/" + result.id) as never);
      else setMessage("Offer declined. You remain available for other work.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending("");
      setAttempt((value) => value + 1);
    }
  }

  const current = offers.filter(
    (offer) => offerSecondsRemaining(offer.expiresAt, now) > 0,
  );
  return (
    <View style={{ gap: 12 }}>
      <Card style={{ backgroundColor: current.length ? c.mint : c.white }}>
        <Row style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
          <T bold size={21}>
            Available job offers
          </T>
          <Badge label={current.length + " open"} />
        </Row>
        <T color={c.muted}>
          Accept only work you can complete at the shown time. Your acceptance
          confirms the job; another professional may accept first.
        </T>
        {!profile?.approved && (
          <T color={c.amber}>
            Complete verification before receiving partner offers.
          </T>
        )}
        {profile?.available === false && (
          <T color={c.amber}>
            You are paused. Go available to receive new offers.
          </T>
        )}
        {!current.length && (
          <T>
            {loading
              ? "Checking for offers…"
              : "No open offers right now. Keep your skills, coverage and availability up to date."}
          </T>
        )}
        {!!message && (
          <T accessibilityLiveRegion="polite" color={c.green}>
            {message}
          </T>
        )}
        {!!error && (
          <T accessibilityRole="alert" color={c.red}>
            {error}
          </T>
        )}
        <Button
          label="Refresh job offers"
          secondary
          disabled={busy || !!pending}
          onPress={() => {
            setLoading(true);
            setAttempt((value) => value + 1);
          }}
        />
      </Card>
      {current.map((offer) => {
        const seconds = offerSecondsRemaining(offer.expiresAt, now);
        return (
          <Card key={offer.id} style={{ borderColor: c.green, borderWidth: 1 }}>
            <Row style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
              <Badge label="New job offer" />
              <T bold color={seconds <= 30 ? c.red : c.green}>
                {Math.floor(seconds / 60) +
                  ":" +
                  String(seconds % 60).padStart(2, "0") +
                  " remaining"}
              </T>
            </Row>
            <T bold size={22}>
              {offer.serviceName}
            </T>
            <T>{dateLabel(offer.slot, lang)}</T>
            <T color={c.muted}>
              {offer.duration + " minutes · PIN " + offer.pin}
            </T>
            {offer.scope.map((scope, i) => (
              <T key={i}>{"• " + scope}</T>
            ))}
            <Divider />
            <Row style={{ justifyContent: "space-between" }}>
              <T style={{ flex: 1 }}>Booking amount</T>
              <T>{money(offer.gross)}</T>
            </Row>
            <Row style={{ justifyContent: "space-between" }}>
              <T style={{ flex: 1 }}>ANVIRA commission</T>
              <T>{money(offer.commission)}</T>
            </Row>
            <Row style={{ justifyContent: "space-between" }}>
              <T bold style={{ flex: 1 }}>
                Your earnings after completion
              </T>
              <T bold color={c.green}>
                {money(offer.net)}
              </T>
            </Row>
            <T size={12} color={c.muted}>
              The exact address and customer details appear after you accept.
              Payment is subject to completion and the payout policy.
            </T>
            <Button
              label="Accept this job"
              disabled={busy || !!pending || seconds === 0}
              loading={pending === offer.id}
              onPress={() => void respond(offer, "accept")}
            />
            <Button
              label="Decline this offer"
              secondary
              disabled={busy || !!pending}
              onPress={() => void respond(offer, "decline")}
            />
          </Card>
        );
      })}
    </View>
  );
}
