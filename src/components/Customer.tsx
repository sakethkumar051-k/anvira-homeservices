import * as Linking from "expo-linking";
import { loadDraft, saveDraft, removeDraft } from "../lib/drafts";
import { ProfessionalPhoto } from "./ProfessionalPhoto";
import { ServiceChoices, ServiceCare } from "./ServiceCustomization";
import React, { useState, useEffect } from "react";
import { View, Pressable, ScrollView, TextInput } from "react-native";
import { router, useLocalSearchParams, useIsFocused } from "expo-router";
import { NotificationCenter, PaymentButton } from "./Experience";
import { Shell } from "./Shell";
import { SupportReply } from "./Workbench";
import { Conversation } from "./Conversation";
import { usePagedRecords, PageControls } from "./PagedRecords";
import {
  T,
  c,
  Card,
  Row,
  Icon,
  Art,
  Button,
  Input,
  Badge,
  Divider,
  Empty,
  styles,
} from "./ui";
import { useApp } from "../lib/context";
import { WEBSITE_STAFF_ONLY } from "../lib/runtime";
import {
  Booking,
  Ticket,
  Service,
  money,
  dateLabel,
  statusLabel,
  slots,
  serviceDay,
  serviceHour,
  atHour,
} from "../lib/model";
const go = (href: string) => router.push(href as never);
export function Home() {
  const { state, t, lang } = useApp();
  const [search, setSearch] = useState("");
  if (!state) return null;
  const services = state.services.filter((s) =>
    (s.name + " " + t(s.name) + " " + t(s.category))
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const featured =
    state.services.find((s) => s.id === "cleaning") || state.services[0];
  const nextBooking = state.bookings
    .filter((b) =>
      [
        "payment_pending",
        "assigned",
        "confirmed",
        "awaiting_assignment",
        "in_progress",
      ].includes(b.status),
    )
    .sort((a, b) => a.slot - b.slot)[0];
  return (
    <Shell>
      {state?.mode === "demo" && (
        <Button
          label="Five-minute client demo"
          secondary
          onPress={() => go("/demo")}
        />
      )}
      <T bold size={25}>
        Good care. Right at home.
      </T>
      {!search && nextBooking && (
        <Card style={{ backgroundColor: c.mint }}>
          <T bold>Your next service</T>
          <T bold size={18}>
            {nextBooking.serviceName}
          </T>
          <T size={12} color={c.muted}>
            {dateLabel(nextBooking.slot, lang)}
          </T>
          <Badge label={statusLabel(nextBooking.status)} />
          <Button
            label="View next booking"
            secondary
            onPress={() => go("/booking/" + nextBooking.id)}
          />
        </Card>
      )}
      <Row
        style={{
          backgroundColor: c.white,
          borderRadius: 16,
          minHeight: 52,
          paddingHorizontal: 16,
        }}
      >
        <Icon name="search" />
        <TextInput
          accessibilityLabel={t("Search services")}
          placeholder={t("Search for a service")}
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={c.muted}
          style={{
            flex: 1,
            fontFamily: lang === "te" ? "Telugu" : "Manrope",
            fontSize: 14,
            color: c.ink,
            minHeight: 52,
          }}
        />
      </Row>
      {!search && featured && (
        <Pressable
          accessibilityLabel={"View " + featured.name}
          onPress={() => go("/service/" + featured.id)}
          style={{
            backgroundColor: c.mint,
            borderRadius: 24,
            overflow: "hidden",
          }}
        >
          <View style={{ padding: 20, paddingBottom: 0, gap: 4 }}>
            <T bold size={18}>
              {featured.headline}
            </T>
            <T size={12} color={c.green}>
              {t(
                featured.id === "cleaning"
                  ? "Deep cleaning from"
                  : "Starting from",
              ) +
                " " +
                money(featured.price)}
            </T>
          </View>
          <View
            style={{ paddingHorizontal: 20, marginTop: 8, paddingBottom: 14 }}
          >
            <Art height={145} />
          </View>
        </Pressable>
      )}
      <Row style={{ justifyContent: "space-between" }}>
        <T size={19} bold>
          What can we help with?
        </T>
        <Pressable onPress={() => go("/services")}>
          <T size={12} color={c.green}>
            View all
          </T>
        </Pressable>
      </Row>
      <View style={styles.grid}>
        {services.map((s) => (
          <Pressable
            key={s.id}
            accessibilityRole="button"
            accessibilityLabel={s.category}
            onPress={() => go("/service/" + s.id)}
            style={{
              width: "30.8%",
              minHeight: 75,
              borderRadius: 16,
              backgroundColor: c.white,
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: 8,
            }}
          >
            <Icon name={s.icon} />
            <T size={11}>{s.id === "ac" ? "AC service" : s.category}</T>
          </Pressable>
        ))}
        {!search && (
          <Pressable
            accessibilityLabel="All services"
            onPress={() => go("/services")}
            style={{
              width: "30.8%",
              minHeight: 75,
              borderRadius: 16,
              backgroundColor: c.white,
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Icon name="grid" />
            <T size={11} bold>
              More
            </T>
          </Pressable>
        )}
      </View>
      {services.length === 0 && (
        <Empty title="No services found" detail="Try another search." />
      )}
    </Shell>
  );
}
export function Services() {
  const { state } = useApp();
  return (
    <Shell title="All services" back>
      {state?.services.map((s) => (
        <ServiceCard key={s.id} s={s} />
      ))}
    </Shell>
  );
}
function ServiceCard({ s }: { s: Service }) {
  return (
    <Pressable onPress={() => go("/service/" + s.id)}>
      <Card>
        <Row>
          <View
            style={{ backgroundColor: c.mint, padding: 16, borderRadius: 16 }}
          >
            <Icon name={s.icon} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <T bold size={17}>
              {s.name}
            </T>
            <T size={12} color={c.muted}>
              {money(s.price)} · {s.duration} min
            </T>
          </View>
          <Icon name="next" />
        </Row>
      </Card>
    </Pressable>
  );
}
export function ServiceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { state, t } = useApp();
  const s = state?.services.find((x) => x.id === id);
  if (!s)
    return (
      <Shell title="Service" back>
        <Empty
          title="Service unavailable"
          detail="Browse the current services."
        />
      </Shell>
    );
  return (
    <Shell
      title={s.category}
      back
      footer={
        <Button label="Continue" onPress={() => go("/checkout/" + s.id)} />
      }
    >
      <View style={{ borderRadius: 24, overflow: "hidden" }}>
        <Art />
      </View>
      <Badge label="ANVIRA assured" />
      <T bold size={25}>
        {s.name}
      </T>
      <T color={c.muted}>{s.description}</T>
      <Row>
        <T bold size={23} color={c.green}>
          {money(s.price)}
        </T>
        <T color={c.muted}>· {s.duration} min</T>
      </Row>
      <Card>
        <T bold size={18}>
          What’s included
        </T>
        {s.includes.map((item) => (
          <Row key={item}>
            <Icon name="check" size={18} />
            <T style={{ flex: 1 }}>{item}</T>
          </Row>
        ))}
      </Card>
      <Card>
        <T bold>Before you book</T>
        <T color={c.muted} size={12}>
          {state?.mode === "demo"
            ? "Sample price. Major repairs, spare parts and specialist materials are excluded. A professional confirms any additional work before starting."
            : "The listed price covers the service scope shown above. Additional work needs your approval."}
        </T>
      </Card>
      <ServiceCare service={s} />
      {!!s.excludes?.length && (
        <Card>
          <T bold>Not included</T>
          {s.excludes.map((x) => (
            <T key={x}>{x}</T>
          ))}
        </Card>
      )}
      <T bold size={18}>
        Verified professionals
      </T>
      {state?.professionals
        .filter((p) => p.skills.includes(s.id))
        .map((p) => (
          <Card key={p.id}>
            <Row>
              <ProfessionalPhoto professional={p} />
              <View style={{ flex: 1 }}>
                <T bold>{p.name}</T>
                <T size={12} color={c.muted}>
                  {p.type} · {p.jobs} completed jobs
                </T>
              </View>
              <T bold color={c.green}>
                ★ {p.rating}
              </T>
            </Row>
          </Card>
        ))}
      <T size={12} color={c.muted}>
        {t(
          "ANVIRA matches an available professional to your service and slot.",
        )}
      </T>
    </Shell>
  );
}
export function SlotPicker({
  value,
  onChange,
  serviceId,
  bookingId,
  pin,
  selection,
}: {
  value: number;
  onChange: (n: number) => void;
  serviceId?: string;
  bookingId?: string;
  pin?: string;
  selection?: string;
}) {
  const { lang, read } = useApp(),
    day = serviceDay(value);
  const [availability, setAvailability] = useState<
      { slot: number; available: boolean }[]
    >([]),
    [message, setMessage] = useState("");
  useEffect(() => {
    let cancelled = false;
    if (serviceId)
      void read<{ slot: number; available: boolean }[]>(
        "/availability?serviceId=" +
          encodeURIComponent(serviceId) +
          "&date=" +
          day +
          (bookingId ? "&bookingId=" + bookingId : "") +
          (pin ? "&pin=" + encodeURIComponent(pin) : "") +
          (selection ? "&selection=" + encodeURIComponent(selection) : ""),
      )
        .then((data) => {
          if (!cancelled) {
            setAvailability(data);
            setMessage("");
          }
        })
        .catch((e) => {
          if (!cancelled) setMessage(e.message);
        });
    return () => {
      cancelled = true;
    };
  }, [serviceId, bookingId, day, pin, selection, read]);
  return (
    <View style={{ gap: 14 }}>
      <T bold>Choose your slot</T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Row>
          {slots().map((n) => (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityLabel={new Date(n).toLocaleDateString("en-IN", {
                timeZone: "Asia/Kolkata",
              })}
              accessibilityState={{ selected: serviceDay(n) === day }}
              onPress={() =>
                onChange(atHour(serviceDay(n), serviceHour(value)))
              }
              style={{
                padding: 14,
                borderRadius: 16,
                backgroundColor: serviceDay(n) === day ? c.green : c.white,
                minWidth: 72,
                alignItems: "center",
              }}
            >
              <T color={serviceDay(n) === day ? c.white : c.ink} size={12}>
                {new Date(n).toLocaleDateString(
                  lang === "te" ? "te-IN" : "en-IN",
                  {
                    timeZone: "Asia/Kolkata",
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  },
                )}
              </T>
            </Pressable>
          ))}
        </Row>
      </ScrollView>
      <T bold>Available time</T>
      <T size={11} color={c.muted}>
        All service times are in Indian Standard Time.
      </T>
      <View style={styles.grid}>
        {[9, 12, 15, 18].map((h) => {
          const time = atHour(day, h),
            available =
              !serviceId ||
              availability.some((a) => a.slot === time && a.available);
          return (
            <Pressable
              key={h}
              accessibilityRole="button"
              accessibilityLabel={`${h}:00 slot`}
              accessibilityState={{
                disabled: !available,
                selected: time === value,
              }}
              disabled={!available}
              onPress={() => onChange(time)}
              style={{
                padding: 14,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: time === value ? c.green : c.line,
                backgroundColor: time === value ? c.mint : c.white,
                width: "46%",
                opacity: available ? 1 : 0.4,
              }}
            >
              <T bold color={c.green}>
                {h > 12 ? h - 12 : h}:00 {h >= 12 ? "PM" : "AM"}
              </T>
            </Pressable>
          );
        })}
      </View>
      {message ? (
        <T color={c.red}>{message}</T>
      ) : serviceId && !availability.length ? (
        <T color={c.muted}>Checking availability…</T>
      ) : null}
    </View>
  );
}
export function Checkout() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { state, request, busy } = useApp();
  const s = state?.services.find((x) => x.id === id);
  const [step, setStep] = useState(0),
    [addon, setAddon] = useState<string[]>([]),
    [packageId, setPackageId] = useState(""),
    [options, setOptions] = useState<Record<string, string>>({}),
    [details, setDetails] = useState<Record<string, string>>({}),
    [instructions, setInstructions] = useState(""),
    [line, setLine] = useState(""),
    [pin, setPin] = useState("509216"),
    [slot, setSlot] = useState(() => slots()[0]),
    [validation, setValidation] = useState(""),
    [promoCode, setPromoCode] = useState(""),
    [quote, setQuote] = useState<{
      total: number;
      discount: number;
      subtotal: number;
      code: string;
    } | null>(null);
  const [key, setKey] = useState(
    () => "booking-" + Date.now() + "-" + Math.random().toString(36).slice(2),
  );
  const [draftStatus, setDraftStatus] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const draftUser = state?.user.id;
  useEffect(() => {
    let current = true;
    if (!draftUser || !id) return;
    void loadDraft<{
      addon: string[];
      packageId: string;
      options: Record<string, string>;
      details: Record<string, string>;
      instructions: string;
      line: string;
      pin: string;
      slot: number;
      key: string;
    }>(draftUser, "checkout-" + id).then((d) => {
      if (!current) return;
      if (d) {
        setAddon(d.addon);
        setPackageId(d.packageId);
        setOptions(d.options);
        setDetails(d.details || {});
        setInstructions(d.instructions);
        setLine(d.line);
        setPin(d.pin);
        setSlot(d.slot > Date.now() + 3600000 ? d.slot : slots()[0]);
        setKey(d.key);
        setDraftStatus(
          "Your saved booking draft is ready. Please review the service and slot.",
        );
      }
      setDraftReady(true);
    });
    return () => {
      current = false;
    };
  }, [draftUser, id]);
  useEffect(() => {
    if (!draftReady || !draftUser || !id) return;
    const timeout = setTimeout(
      () =>
        void saveDraft(draftUser, "checkout-" + id, {
          addon,
          packageId,
          options,
          details,
          instructions,
          line,
          pin,
          slot,
          key,
        })
          .then(() =>
            setDraftStatus(
              "Draft saved on this device. It does not reserve a service slot.",
            ),
          )
          .catch(() =>
            setDraftStatus(
              "Draft could not be saved. Keep this page open until you finish.",
            ),
          ),
      1200,
    );
    return () => clearTimeout(timeout);
  }, [
    draftReady,
    draftUser,
    id,
    addon,
    packageId,
    options,
    details,
    instructions,
    line,
    pin,
    slot,
    key,
  ]);
  if (!s)
    return (
      <Shell title="Service unavailable" back>
        <T>Choose another service.</T>
      </Shell>
    );
  const pack = s.packages?.find((p) => p.id === packageId);
  const choices = (s.optionGroups || []).flatMap((g) =>
    g.options
      .filter((o) => o.id === options[g.id])
      .map((o) => ({ ...o, group: g.name })),
  );
  const basePrice = pack?.price ?? s.price;
  const duration =
    (pack?.duration ?? s.duration) +
    choices.reduce((n, o) => n + o.duration, 0);
  const selection = {
    packageId: packageId || undefined,
    options,
    addons: addon,
  };
  const subtotal =
    basePrice +
    choices.reduce((n, o) => n + o.price, 0) +
    s.addons
      .filter((a) => addon.includes(a.id))
      .reduce((sum, a) => sum + a.price, 0);
  const offer =
      quote?.subtotal === subtotal &&
      quote.code === promoCode.trim().toUpperCase()
        ? quote
        : null,
    total = offer?.total ?? subtotal;
  async function next() {
    if (step === 0) {
      const missing = s?.optionGroups?.find(
        (g) => g.required && !options[g.id],
      );
      const missingDetail = s?.bookingFields?.find(
        (f) => f.required && (details[f.id] || "").trim().length < 2,
      );
      if (missing || missingDetail || duration > 240 || subtotal > 100000) {
        setValidation(
          missing
            ? "Choose an option for " + missing.name + "."
            : missingDetail
              ? "Enter " + missingDetail.label + "."
              : "Choose fewer extras to stay within the service limit.",
        );
        return;
      }
      setValidation("");
      setStep(1);
      return;
    }
    if (step === 1) {
      if (line.trim().length < 8 || !state?.settings.pins.includes(pin)) {
        setValidation(
          "Enter a complete address and a supported PIN: " +
            state?.settings.pins.join(", ") +
            ".",
        );
        return;
      }
      setValidation("");
      setStep(2);
      return;
    }
    try {
      const b = await request<Booking>("/bookings", {
        serviceId: id,
        ...selection,
        instructions,
        details,
        ...(offer ? { promoCode: offer.code } : {}),
        address: { line, pin },
        slot,
        idempotencyKey: key,
      });
      if (draftUser)
        await removeDraft(draftUser, "checkout-" + id).catch(() => {});
      router.replace(("/booking/" + b.id) as never);
    } catch (e) {
      setValidation((e as Error).message);
    }
  }
  return (
    <Shell
      title={
        ["Customize service", "Address & schedule", "Booking summary"][step]
      }
      back
      footer={
        <View style={{ gap: 10 }}>
          <Row style={{ justifyContent: "space-between" }}>
            <T bold>Service total</T>
            <T size={22} bold color={c.green}>
              {money(total)}
            </T>
          </Row>
          <Button
            label={step === 2 ? "Continue to payment" : "Continue"}
            loading={busy}
            onPress={() => void next()}
          />
        </View>
      }
    >
      <Row>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 4,
              backgroundColor: i <= step ? c.green : c.line,
            }}
          />
        ))}
      </Row>
      <T bold size={23}>
        {s.name}
      </T>
      {!!draftStatus && (
        <T size={12} color={c.muted}>
          {draftStatus}
        </T>
      )}
      {!!validation && (
        <T accessibilityRole="alert" color={c.red}>
          {validation}
        </T>
      )}
      {step === 0 ? (
        <>
          <Art />
          <ServiceChoices
            service={s}
            packageId={packageId}
            options={options}
            onPackage={setPackageId}
            onOption={(id, value) =>
              setOptions((o) => {
                const next = { ...o };
                if (value) next[id] = value;
                else delete next[id];
                return next;
              })
            }
          />
          <ServiceCare service={s} />
          {!!s.bookingFields?.length && (
            <Card>
              <T bold>Details for this service</T>
              {s.bookingFields.map((f) => (
                <View key={f.id} style={{ gap: 6 }}>
                  <Input
                    label={
                      f.label + (f.required ? " (required)" : " (optional)")
                    }
                    placeholder={f.placeholder}
                    value={details[f.id] || ""}
                    onChangeText={(v) =>
                      setDetails((d) => ({ ...d, [f.id]: v }))
                    }
                    maxLength={300}
                  />
                  {!!f.help && (
                    <T size={12} color={c.muted}>
                      {f.help}
                    </T>
                  )}
                </View>
              ))}
            </Card>
          )}
          <Input
            label="Instructions for your professional"
            placeholder="Access directions, pets, areas needing care (optional)"
            value={instructions}
            onChangeText={setInstructions}
            maxLength={1000}
            multiline
          />
          <Card>
            <Badge label="Optional" />
            <T bold size={18}>
              Make it yours
            </T>
            {s.addons.map((a) => (
              <Pressable
                key={a.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: addon.includes(a.id) }}
                accessibilityLabel={a.name}
                onPress={() =>
                  setAddon(
                    addon.includes(a.id)
                      ? addon.filter((x) => x !== a.id)
                      : [...addon, a.id],
                  )
                }
              >
                <Row>
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderWidth: 1,
                      borderColor: c.green,
                      borderRadius: 6,
                      backgroundColor: addon.includes(a.id) ? c.mint : c.white,
                    }}
                  >
                    {addon.includes(a.id) && <Icon name="check" />}
                  </View>
                  <T style={{ flex: 1 }}>{a.name}</T>
                  <T bold>{money(a.price)}</T>
                </Row>
              </Pressable>
            ))}
          </Card>
          <T size={12} color={c.muted}>
            You can continue without an add-on.
          </T>
        </>
      ) : step === 1 ? (
        <>
          <Card>
            {state?.addresses.map((a) => (
              <Button
                key={a.id}
                label={a.label + " · " + a.line}
                secondary
                onPress={() => {
                  setLine(a.line);
                  setPin(a.pin);
                }}
              />
            ))}
            <Input
              label="Your address"
              placeholder="House / flat, street, landmark"
              value={line}
              onChangeText={setLine}
              multiline
            />
            <Input
              label="PIN code"
              value={pin}
              onChangeText={setPin}
              keyboardType="number-pad"
              maxLength={6}
            />
            <T color={c.muted} size={12}>
              Service area PINs: {state?.settings.pins.join(", ")}
            </T>
          </Card>
          <SlotPicker
            value={slot}
            onChange={setSlot}
            serviceId={id}
            pin={pin}
            selection={JSON.stringify(selection)}
          />
        </>
      ) : (
        <>
          <Card>
            <T bold>Service</T>
            <T>{s.name}</T>
            {!!pack && <T bold>{pack.name}</T>}
            {choices.map((o, i) => (
              <T key={i}>
                {o.group +
                  ": " +
                  o.name +
                  (o.price ? " · +" + money(o.price) : " · Included")}
              </T>
            ))}
            <T>{duration + " minutes"}</T>
            {s.bookingFields
              ?.filter((f) => details[f.id])
              .map((f) => (
                <T key={f.id}>{f.label + ": " + details[f.id]}</T>
              ))}
            {!!instructions && <T>{instructions}</T>}
            {s.addons
              .filter((a) => addon.includes(a.id))
              .map((a) => (
                <T key={a.id}>{a.name}</T>
              ))}
            <Divider />
            <T bold>Your address</T>
            <T>
              {line} · {pin}
            </T>
            <Divider />
            <T bold>Choose your slot</T>
            <T>{dateLabel(slot)}</T>
            <Pressable onPress={() => setStep(1)}>
              <T bold color={c.green}>
                Edit address or slot
              </T>
            </Pressable>
          </Card>
          <Card>
            <Row style={{ justifyContent: "space-between" }}>
              <T>Service</T>
              <T>{money(basePrice)}</T>
            </Row>
            {(addon.length > 0 || choices.length > 0) && (
              <Row style={{ justifyContent: "space-between" }}>
                <T>Add-ons</T>
                <T>{money(subtotal - basePrice)}</T>
              </Row>
            )}
            <Divider />
            <Row style={{ justifyContent: "space-between" }}>
              <T bold>Service total</T>
              <T bold size={23} color={c.green}>
                {money(total)}
              </T>
            </Row>
          </Card>
          <Input
            label="Offer code"
            value={promoCode}
            onChangeText={setPromoCode}
            autoCapitalize="characters"
          />
          <Button
            label="Apply offer"
            secondary
            loading={busy}
            disabled={!promoCode.trim()}
            onPress={() =>
              void request<{
                total: number;
                discount: number;
                subtotal: number;
              }>("/quote", { serviceId: id, ...selection, promoCode })
                .then((q) =>
                  setQuote({ ...q, code: promoCode.trim().toUpperCase() }),
                )
                .catch(() => setQuote(null))
            }
          />
          {offer && (
            <Badge
              label={"Offer applied · " + money(offer.discount) + " saved"}
            />
          )}
          <T size={12} color={c.muted}>
            {state?.mode === "demo" ? "Sample policy: " : "Booking policy: "}{" "}
            cancel or reschedule up to {state?.settings.cancelCutoffHours ?? 2}{" "}
            hours before the slot. Later changes need Customer Care. Unfulfilled
            paid bookings receive a full refund.
          </T>
        </>
      )}
      <Row style={{ justifyContent: "space-between" }}>
        <T color={c.muted}>Service total</T>
        <T size={23} bold color={c.green}>
          {money(total)}
        </T>
      </Row>
      {step > 0 && (
        <Button
          label="Previous step"
          secondary
          onPress={() => setStep(step - 1)}
        />
      )}
    </Shell>
  );
}
export function BookingCard({ b }: { b: Booking }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={"Open " + b.serviceName + " booking"}
      onPress={() => go("/booking/" + b.id)}
    >
      <Card>
        <Badge
          label={statusLabel(b.status)}
          tone={
            b.status === "cancelled"
              ? "red"
              : b.status === "payment_pending"
                ? "amber"
                : "green"
          }
        />
        <T bold size={18}>
          {b.serviceName}
        </T>
        <T size={12} color={c.muted}>
          {dateLabel(b.slot)}
        </T>
        <Row style={{ justifyContent: "space-between" }}>
          <T bold color={c.green}>
            {money(b.total)}
          </T>
          <Icon name="next" />
        </Row>
      </Card>
    </Pressable>
  );
}
export function Bookings() {
  const { state, read } = useApp(),
    [filter, setFilter] = useState("active"),
    [older, setOlder] = useState<Booking[]>([]),
    [more, setMore] = useState(true),
    [loading, setLoading] = useState(false),
    [message, setMessage] = useState("");
  async function load() {
    const last = older.at(-1) || state?.bookings.at(-1);
    if (!last) return;
    setLoading(true);
    try {
      const page = await read<{ rows: Booking[]; nextCursor: unknown }>(
        "/bookings?cursor=" +
          encodeURIComponent(JSON.stringify([last.createdAt, last.id])),
      );
      setOlder((rows) => [...rows, ...page.rows]);
      setMore(!!page.nextCursor);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  const bookings =
    [
      ...new Map(
        [...(state?.bookings || []), ...older].map((b) => [b.id, b]),
      ).values(),
    ]
      .filter((b) =>
        filter === "active"
          ? !["completed", "cancelled", "payment_expired"].includes(b.status)
          : ["completed", "cancelled", "payment_expired"].includes(b.status),
      )
      .sort((a, b) => b.createdAt - a.createdAt) || [];
  return (
    <Shell title="Bookings">
      <Row>
        {["active", "past"].map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={{
              flex: 1,
              padding: 14,
              borderRadius: 16,
              backgroundColor: filter === f ? c.mint : c.white,
            }}
          >
            <T bold color={c.green}>
              {f === "active" ? "Upcoming" : "Past bookings"}
            </T>
          </Pressable>
        ))}
      </Row>
      {bookings.map((b) => (
        <BookingCard key={b.id} b={b} />
      ))}
      {state?.hasMoreBookings && more && (
        <Button
          label="Load earlier bookings"
          secondary
          loading={loading}
          onPress={() => void load()}
        />
      )}
      {message && <T color={c.red}>{message}</T>}
      {!bookings.length && (
        <Empty
          title="No bookings yet"
          detail="Thoughtful care for your home, whenever you need it."
        >
          <Button
            label="Book your first service"
            onPress={() => go("/services")}
          />
        </Empty>
      )}
    </Shell>
  );
}
export function BookingDetail() {
  const focused = useIsFocused();
  const { id } = useLocalSearchParams<{ id: string }>(),
    { state, request, busy, lang, read } = useApp();
  const [loaded, setLoaded] = useState<Booking | null>(null);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const current = state?.bookings.find((x) => x.id === id);
  useEffect(() => {
    if (!focused) return;
    let cancelled = false;
    setLoaded(null);
    setLoadError("");
    if (state?.user.id && !current)
      void read<Booking>("/bookings/" + id)
        .then((b) => {
          if (!cancelled) setLoaded(b);
        })
        .catch((e) => {
          if (!cancelled) setLoadError((e as Error).message);
        });
    return () => {
      cancelled = true;
    };
  }, [id, state?.user.id, current, read, attempt, focused]);
  const b = current || loaded,
    p = state?.professionals.find((x) => x.id === b?.professionalId);
  const [edit, setEdit] = useState(false),
    [slot, setSlot] = useState(() => slots()[0]),
    [cancel, setCancel] = useState(false),
    [rating, setRating] = useState(5),
    [review, setReview] = useState(""),
    [checks, setChecks] = useState([false, false, false]),
    [completionNotes, setCompletionNotes] = useState("");
  if (!b)
    return (
      <Shell title="Booking details" back>
        <Empty
          title={loadError ? "Unable to load booking" : "Loading booking…"}
          detail={loadError || "Please wait while we retrieve your booking."}
        />
        {!!loadError && (
          <Button label="Try again" onPress={() => setAttempt((v) => v + 1)} />
        )}
      </Shell>
    );
  const role = state!.user.role;
  async function action(action: string, data = {}) {
    try {
      const result = await request<Booking>("/bookings/" + id + "/action", {
        action,
        ...data,
      });
      setLoaded(result);
      if (action === "decline") go("/jobs");
      setEdit(false);
      setCancel(false);
    } catch {}
  }
  const canChange = ["assigned", "confirmed", "awaiting_assignment"].includes(
    b.status,
  );
  return (
    <Shell title="Booking details" back>
      <Badge
        label={statusLabel(b.status)}
        tone={b.status === "cancelled" ? "red" : "green"}
      />
      <T bold size={25}>
        {b.serviceName}
      </T>
      <Card>
        <Row>
          <Icon name="calendar" />
          <T style={{ flex: 1 }}>{dateLabel(b.slot, lang)}</T>
        </Row>
        <Divider />
        <Row>
          <Icon name="home" />
          <T style={{ flex: 1 }}>
            {b.address.line} · {b.address.pin}
          </T>
        </Row>
        {role === "professional" && (
          <Button
            label="Open address in Maps"
            secondary
            onPress={() =>
              void Linking.openURL(
                "https://www.google.com/maps/search/?api=1&query=" +
                  encodeURIComponent(
                    b.address.line + ", " + b.address.pin + ", India",
                  ),
              ).catch(() => {})
            }
          />
        )}
        <Divider />
        <Row style={{ justifyContent: "space-between" }}>
          <T>Service total</T>
          <T bold size={22} color={c.green}>
            {money(b.total)}
          </T>
        </Row>
        <T size={11} color={c.muted}>
          Booking #{b.id.slice(0, 8).toUpperCase()}
        </T>
      </Card>
      <Card>
        <T bold>Booking progress</T>
        {(
          [
            ["Booking created", b.createdAt],
            ["Professional assigned", b.assignedAt],
            ["Professional confirmed", b.acceptedAt],
            ["Professional arrived", b.arrivedAt],
            ["Service started", b.startedAt],
            ["Service completed", b.completedAt],
            ["Booking cancelled", b.cancelledAt],
          ] as [string, number | undefined][]
        )
          .filter(([, at]) => !!at)
          .map(([label, at]) => (
            <Row
              key={label}
              style={{ justifyContent: "space-between", flexWrap: "wrap" }}
            >
              <T size={12}>{label}</T>
              <T size={11} color={c.muted}>
                {dateLabel(at!, lang)}
              </T>
            </Row>
          ))}
      </Card>
      {p && (
        <Card>
          <T bold>Your professional</T>
          <Row>
            <ProfessionalPhoto professional={p} size={64} />
            <View style={{ flex: 1 }}>
              <T bold size={18}>
                {p.name}
              </T>
              <T color={c.muted} size={12}>
                {p.type} · ★ {p.rating}
              </T>
            </View>
            <Icon name="shield" />
          </Row>
          {!!p.bio && <T>{p.bio}</T>}
          {!!p.languages?.length && (
            <T color={c.muted}>{"Speaks " + p.languages.join(", ")}</T>
          )}
          <T size={12} color={c.muted}>
            {b.status === "assigned"
              ? "Your professional will confirm the job shortly."
              : "ANVIRA verified professional"}
          </T>
        </Card>
      )}
      {role === "customer" && b.status === "payment_pending" && (
        <Card style={{ backgroundColor: c.mint }}>
          <T bold size={20}>
            Payment
          </T>
          <T>
            {state?.mode === "demo"
              ? "No real charge. Demo payment only."
              : "Pay securely to reserve your home service."}
          </T>
          <PaymentButton booking={b} />
        </Card>
      )}
      <Conversation booking={b} />
      {role === "customer" && (canChange || b.status === "payment_pending") && (
        <>
          {canChange && (
            <Button
              label="Reschedule"
              secondary
              disabled={busy}
              onPress={() => setEdit(!edit)}
            />
          )}
          <Button
            label="Cancel booking"
            secondary
            disabled={busy}
            onPress={() => setCancel(!cancel)}
          />
        </>
      )}
      {edit && (
        <Card>
          <SlotPicker
            value={slot}
            onChange={setSlot}
            serviceId={b.serviceId}
            bookingId={b.id}
            pin={b.address.pin}
          />
          <Button
            label="Save new slot"
            loading={busy}
            onPress={() => void action("reschedule", { slot })}
          />
        </Card>
      )}
      {cancel && (
        <Card style={{ backgroundColor: c.redbg }}>
          <T bold>Cancel this booking?</T>
          <T size={12}>
            A paid booking will create a full refund request for Owner approval.
            {state?.mode === "demo"
              ? "This preview simulates the refund."
              : "Refunds return to the original payment method after approval."}
          </T>
          <Button
            label="Confirm cancellation"
            danger
            loading={busy}
            onPress={() => void action("cancel")}
          />
          <Button
            label="Keep booking"
            secondary
            onPress={() => setCancel(false)}
          />
        </Card>
      )}
      {b.refund && (
        <Card>
          <Badge label={statusLabel(b.refund)} tone="amber" />
          <T size={12} color={c.muted}>
            Refund amount: {money(b.total)} ·{" "}
            {state?.mode === "demo" ? "Demo only" : "Original payment method"}
          </T>
        </Card>
      )}
      {role === "professional" && b.status === "assigned" && (
        <>
          <Button
            label="Accept job"
            loading={busy}
            onPress={() => void action("accept")}
          />
          <Button
            label="Decline job"
            secondary
            disabled={busy}
            onPress={() => void action("decline")}
          />
        </>
      )}
      {(b.packageName ||
        b.choices?.length ||
        b.details?.length ||
        b.instructions ||
        b.scope?.length) && (
        <Card>
          <T bold>Service plan</T>
          {!!b.packageName && <T bold>{b.packageName}</T>}
          {b.choices?.map((x, i) => (
            <T key={i}>{x.group + ": " + x.name}</T>
          ))}
          {b.scope?.map((x, i) => (
            <T key={i}>{"• " + x}</T>
          ))}
          {b.details?.map((f) => (
            <T key={f.id}>{f.label + ": " + f.value}</T>
          ))}
          {!!b.instructions && (
            <>
              <T bold>Customer instructions</T>
              <T>{b.instructions}</T>
            </>
          )}
          {!!b.warranty && (
            <>
              <T bold>Warranty & revisit terms</T>
              <T>{b.warranty}</T>
            </>
          )}
        </Card>
      )}
      {role === "customer" && b.status === "completed" && (
        <Button
          label="Request a revisit or report a concern"
          secondary
          onPress={() => go("/support?bookingId=" + b.id + "&topic=quality")}
        />
      )}
      {!!b.completionNotes && (
        <Card>
          <T bold>Professional handover notes</T>
          <T>{b.completionNotes}</T>
        </Card>
      )}
      {role === "professional" &&
        b.status === "confirmed" &&
        (b.arrivedAt ? (
          <Badge label="Arrival recorded" />
        ) : (
          <Button
            label="I have arrived"
            secondary
            loading={busy}
            onPress={() => void action("arrive")}
          />
        ))}
      {role === "professional" && b.status === "confirmed" && (
        <Button
          label="Start service"
          loading={busy}
          onPress={() => void action("start")}
        />
      )}
      {role === "professional" && b.status === "in_progress" && (
        <Card>
          <T bold size={19}>
            Service checklist
          </T>
          {[
            ...(b.serviceChecklist || []),
            "Work completed as agreed",
            "Area cleaned and tools packed",
            "Customer walkthrough completed",
          ].map((x, i) => (
            <Pressable
              key={x}
              accessibilityRole="checkbox"
              accessibilityLabel={x}
              accessibilityState={{ checked: checks[i] }}
              onPress={() =>
                setChecks(
                  Array.from(
                    { length: 3 + (b.serviceChecklist?.length || 0) },
                    (_, j) => (j === i ? !checks[j] : !!checks[j]),
                  ),
                )
              }
            >
              <Row>
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderWidth: 1,
                    borderColor: c.green,
                    borderRadius: 6,
                  }}
                >
                  {checks[i] && <Icon name="check" />}
                </View>
                <T style={{ flex: 1 }}>{x}</T>
              </Row>
            </Pressable>
          ))}
          <Input
            label="Handover notes for the customer"
            value={completionNotes}
            onChangeText={setCompletionNotes}
            maxLength={1000}
            multiline
            placeholder="Work completed, care advice, any follow-up (optional)"
          />
          <Button
            label="Complete service"
            loading={busy}
            disabled={
              checks.length !== 3 + (b.serviceChecklist?.length || 0) ||
              !checks.every(Boolean)
            }
            onPress={() =>
              void action("complete", { checklist: checks, completionNotes })
            }
          />
        </Card>
      )}
      {role === "customer" && b.status === "completed" && !b.review && (
        <Card>
          <T bold size={19}>
            Rate your experience
          </T>
          <Row>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                accessibilityLabel={`${n} stars`}
                onPress={() => setRating(n)}
                style={{ padding: 8 }}
              >
                <Icon
                  name="star"
                  color={n <= rating ? c.green : c.line}
                  size={26}
                />
              </Pressable>
            ))}
          </Row>
          <Input
            label="Your review"
            value={review}
            onChangeText={setReview}
            placeholder="Tell us about your service"
          />
          <Button
            label="Submit review"
            loading={busy}
            onPress={() => void action("review", { rating, text: review })}
          />
        </Card>
      )}
      {b.review && (
        <Card>
          <T bold>★ {b.review.rating} · Thank you for your review</T>
          <T>{b.review.text}</T>
          {b.review.rating <= 3 && (
            <T color={c.green}>
              We have opened a support request to follow up on your experience.
            </T>
          )}
        </Card>
      )}
      {b.payment !== "pending" && (
        <Card>
          <T bold>Receipt</T>
          <T size={12} color={c.muted}>
            {state?.mode === "demo"
              ? "Sample service receipt · not a tax invoice"
              : "Booking receipt · not a tax invoice"}
          </T>
          <Row style={{ justifyContent: "space-between" }}>
            <T>Service</T>
            <T>{money(b.price)}</T>
          </Row>
          {b.choices?.map((o, i) => (
            <Row key={i} style={{ justifyContent: "space-between" }}>
              <T style={{ flex: 1 }}>{o.group + ": " + o.name}</T>
              <T>{money(o.price)}</T>
            </Row>
          ))}
          {b.addons.map((a) => (
            <Row key={a.id} style={{ justifyContent: "space-between" }}>
              <T>{a.name}</T>
              <T>{money(a.price)}</T>
            </Row>
          ))}
          {!!b.discount && (
            <Row style={{ justifyContent: "space-between" }}>
              <T>Discount</T>
              <T color={c.green}>{"−" + money(b.discount)}</T>
            </Row>
          )}
          <Divider />
          <Row style={{ justifyContent: "space-between" }}>
            <T bold>Total paid</T>
            <T bold>{money(b.total)}</T>
          </Row>
          <Badge
            label={
              b.payment === "refunded"
                ? "Refund complete"
                : state?.mode === "demo"
                  ? "Demo payment recorded"
                  : "Payment captured"
            }
          />
        </Card>
      )}
      {["owner", "care"].includes(role) && canChange && (
        <Card>
          <T bold>Assign a professional</T>
          {state?.professionals
            .filter((p) => p.approved && p.skills.includes(b.serviceId))
            .map((p) => (
              <Button
                key={p.id}
                label={"Assign " + p.name}
                secondary
                loading={busy}
                onPress={() => void action("assign", { professionalId: p.id })}
              />
            ))}
          <Button label="Reschedule" secondary onPress={() => setEdit(!edit)} />
          <Button
            label="Cancel booking"
            secondary
            onPress={() => setCancel(!cancel)}
          />
        </Card>
      )}
      {role === "owner" && b.refund === "requested" && (
        <Button
          label="Approve full refund"
          loading={busy}
          onPress={() => void action("refund")}
        />
      )}
      {role === "customer" && ["completed", "cancelled"].includes(b.status) && (
        <Button
          label="Book this service again"
          onPress={() => go("/service/" + b.serviceId)}
        />
      )}
      <Button
        label="Support"
        secondary
        onPress={() => go("/support?bookingId=" + encodeURIComponent(b.id))}
      />
    </Shell>
  );
}
export function Profile() {
  const { state, logout, lang, setLang, switchWorkspace, busy } = useApp();
  return (
    <Shell title="Profile">
      <Card>
        <Row>
          <View
            style={{ backgroundColor: c.mint, borderRadius: 40, padding: 16 }}
          >
            <Icon name="person" size={32} />
          </View>
          <View>
            <T bold size={22}>
              {state?.user.name}
            </T>
            <T color={c.muted} size={12}>
              {state?.mode === "demo"
                ? "Demo account"
                : state?.user.phone || state?.user.email || "ANVIRA account"}
            </T>
          </View>
        </Row>
      </Card>
      <Card>
        <T bold>Language</T>
        <Row>
          {(["en", "te"] as const).map((l) => (
            <Pressable
              accessibilityLabel={l === "en" ? "English" : "Telugu"}
              key={l}
              onPress={() => setLang(l)}
              style={{
                flex: 1,
                padding: 14,
                borderRadius: 14,
                backgroundColor: l === lang ? c.mint : c.ivory,
              }}
            >
              <T bold color={c.green}>
                {l === "en" ? "English" : "తెలుగు"}
              </T>
            </Pressable>
          ))}
        </Row>
      </Card>
      {!WEBSITE_STAFF_ONLY && state?.user.primaryRole === "professional" && (
        <Button
          label={
            state.user.role === "professional"
              ? "Switch to customer app"
              : "Switch to professional app"
          }
          secondary
          loading={busy}
          onPress={() => {
            const role =
              state.user.role === "professional" ? "customer" : "professional";
            void switchWorkspace(role)
              .then(() =>
                router.replace(role === "customer" ? "/home" : "/jobs"),
              )
              .catch(() => {});
          }}
        />
      )}
      <Button
        label="Account settings"
        secondary
        onPress={() => go("/account")}
      />
      {state?.user.role === "customer" && (
        <>
          <Button
            label="Saved addresses"
            secondary
            onPress={() => go("/addresses")}
          />
          <Button
            label="Become an ANVIRA professional"
            secondary
            onPress={() => go("/partner")}
          />
        </>
      )}
      {state?.user.role === "professional" && (
        <Button
          label="Professional profile & schedule"
          secondary
          onPress={() => go("/partner")}
        />
      )}
      <Button
        label="Notifications"
        secondary
        onPress={() => go("/notifications")}
      />
      <Button label="Support" secondary onPress={() => go("/support")} />
      <Card>
        <T bold>Privacy & booking policy</T>
        <T size={12} color={c.muted}>
          {state?.mode === "demo"
            ? "This development preview uses sample accounts. Final policies require business approval before launch."
            : "Read the published service terms and privacy policy in Account settings."}
        </T>
      </Card>
      <Button
        label="Sign out"
        secondary
        onPress={() => {
          logout();
          router.replace("/");
        }}
      />
    </Shell>
  );
}
export function Support() {
  const tickets = usePagedRecords<Ticket>("tickets");
  const { bookingId, topic } = useLocalSearchParams<{
    bookingId?: string;
    topic?: string;
  }>();
  const [category, setCategory] = useState(
    topic === "quality" ? "quality" : "general",
  );
  const { state, request, busy } = useApp(),
    [message, setMessage] = useState(""),
    [sent, setSent] = useState(false),
    [sendError, setSendError] = useState(""),
    [sendKey, setSendKey] = useState(
      () => "support-" + Date.now() + "-" + Math.random().toString(36).slice(2),
    );
  async function submit() {
    setSendError("");
    setSent(false);
    if (message.trim().length < 2) {
      setSendError("Enter at least two characters to send a request.");
      return;
    }
    try {
      await request("/tickets", {
        message,
        idempotencyKey: sendKey,
        category,
        ...(bookingId ? { bookingId } : {}),
      });
      setMessage("");
      setSent(true);
      setSendKey(
        "support-" + Date.now() + "-" + Math.random().toString(36).slice(2),
      );
    } catch (e) {
      setSendError((e as Error).message);
    }
  }
  return (
    <Shell title="Support" back>
      <T bold size={25}>
        How can we help?
      </T>
      {state?.user.role === "customer" ||
      state?.user.role === "professional" ? (
        <Card>
          {bookingId && (
            <T bold>{"Booking #" + bookingId.slice(0, 8).toUpperCase()}</T>
          )}
          <T bold>What do you need help with?</T>
          <Row style={{ flexWrap: "wrap" }}>
            {[
              ["general", "General"],
              ["quality", "Service quality"],
              ["schedule", "Schedule"],
              ["payment", "Payment"],
            ].map(([value, label]) => (
              <Button
                key={value}
                label={label}
                secondary={category !== value}
                onPress={() => setCategory(value)}
              />
            ))}
          </Row>
          <Input
            label="Describe your issue"
            placeholder="Tell us what happened"
            value={message}
            onChangeText={(v) => {
              setMessage(v);
              setSent(false);
            }}
            multiline
            style={{ minHeight: 130 }}
          />
          <Button
            label="Send request"
            disabled={busy}
            loading={busy}
            onPress={() => void submit()}
          />
          {sendError && (
            <T accessibilityRole="alert" color={c.red}>
              {sendError}
            </T>
          )}
          {sent && <Badge label="Request sent" />}
        </Card>
      ) : (
        <T color={c.muted}>
          Customer requests appear in the operations support workspace.
        </T>
      )}
      <PageControls list={tickets} label="support" />
      {!tickets.busy && !tickets.error && !tickets.rows.length && (
        <Empty
          title="No support requests yet"
          detail="Your conversations and follow-ups will appear here."
        />
      )}
      {tickets.rows.map((t) => (
        <Card key={t.id}>
          <Badge label={t.status} />
          {t.status === "open" && t.responseDueAt && (
            <T size={12} color={c.muted}>
              {"Response target: " +
                dateLabel(t.responseDueAt) +
                ". This is a support target, not a guaranteed resolution time."}
            </T>
          )}
          <T>{t.message}</T>
          {t.bookingId && (
            <Button
              label={"View booking #" + t.bookingId.slice(0, 8).toUpperCase()}
              secondary
              onPress={() => go("/booking/" + t.bookingId)}
            />
          )}
          <SupportReply ticket={t} />
          <T size={11} color={c.muted}>
            {dateLabel(t.createdAt)}
          </T>
        </Card>
      ))}
    </Shell>
  );
}
export function Notifications() {
  return <NotificationCenter />;
}
