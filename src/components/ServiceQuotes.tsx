import { availableServicePins } from "../lib/service-catalog";
import React, { useCallback, useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useApp } from "../lib/context";
import { money, slots } from "../lib/model";
import { Shell } from "./Shell";
import { T, Card, Button, Input, Row, c } from "./ui";
import { SlotPicker } from "./Customer";
type Quote = {
  id: string;
  serviceId: string;
  serviceName: string;
  billingPeriod?: "one_time" | "monthly";
  customerName: string;
  description: string;
  address: { line: string; pin: string; label?: string };
  status: string;
  revision: number;
  total?: number;
  scope?: string;
  expiresAt?: number;
  bookingId?: string;
  items?: { label: string; quantity: number; unitPrice: number }[];
  serviceDetails?: { id: string; label: string; value: string }[];
};
export function ServiceQuotes({ embedded = false }: { embedded?: boolean }) {
  const { quoteId } = useLocalSearchParams<{ quoteId?: string }>();
  return (
    <QuoteWorkspace
      key={quoteId || "inbox"}
      embedded={embedded}
      quoteId={quoteId}
    />
  );
}

function QuoteWorkspace({
  embedded,
  quoteId,
}: {
  embedded: boolean;
  quoteId?: string;
}) {
  const { state, read, request, busy, selectedAddress } = useApp();
  const { serviceId, packageId } = useLocalSearchParams<{
    serviceId?: string;
    packageId?: string;
  }>();
  const [rows, setRows] = useState<Quote[]>([]),
    [cursor, setCursor] = useState<number | string | null>(null),
    [error, setError] = useState("");
  const [sendKey, setSendKey] = useState(
    () => "quote-" + Date.now() + "-" + Math.random().toString(36).slice(2),
  );
  const preferredPackage = state?.services
    .find((s) => s.id === serviceId && s.active)
    ?.packages?.find((p) => p.id === packageId);
  const [editedDescription, setDescription] = useState<string>();
  const [line, setLine] = useState(selectedAddress?.line || ""),
    [pin, setPin] = useState(selectedAddress?.pin || ""),
    [selected, setSelected] = useState(serviceId || "");
  const description =
    editedDescription ??
    (selected === serviceId && preferredPackage
      ? "I’d like a quote for " + preferredPackage.name + ". "
      : "");
  const [details, setDetails] = useState<Record<string, string>>({});
  const selectedService = state?.services.find((s) => s.id === selected);
  const monthly = selectedService?.billingPeriod === "monthly";
  const allowedPins = availableServicePins(
    state?.settings.pins || [],
    selectedService,
  );
  const chosenAddress = state?.addresses.find(
    (a) => a.line === line && a.pin === pin,
  );
  const missingDetail = selectedService?.bookingFields?.find(
    (f) => f.required && (details[f.id] || "").trim().length < 2,
  );
  const load = useCallback(async () => {
    try {
      if (quoteId) {
        const quote = await read<Quote>(
          "/service-quotes/" + encodeURIComponent(quoteId),
        );
        setRows([quote]);
        setError("");
        return;
      }
      const data = await read<{ rows: Quote[]; nextCursor: unknown }>(
        "/service-quotes",
      );
      setRows(data.rows);
      setCursor(data.nextCursor ? JSON.stringify(data.nextCursor) : null);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [read, quoteId]);
  useEffect(() => {
    if (!state?.user.id) return;
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [state?.user.id, load]);
  const customer = state?.user.role === "customer";
  const content = (
    <>
      {!!error && <T color={c.red}>{error}</T>}
      <Button label="Refresh quotes" secondary onPress={() => void load()} />
      {quoteId && (
        <Button
          label="View all quotes"
          secondary
          onPress={() =>
            router.replace(embedded ? "/dashboard/quotes" : "/quotes")
          }
        />
      )}
      {customer && !quoteId && (
        <Card>
          <T bold size={20}>
            {monthly ? "Request a monthly plan" : "Request a tailored quote"}
          </T>
          <T color={c.muted}>
            {monthly
              ? "Share your car details and preferred days. The team will confirm your monthly price and schedule. Sending a request does not start billing."
              : "Describe work outside a standard package. Review the final scope and price before booking. No payment is taken for a request."}
          </T>
          <Row style={{ flexWrap: "wrap" }}>
            {state?.services
              .filter((s) => s.active)
              .map((s) => (
                <Button
                  key={s.id}
                  label={s.name}
                  secondary={selected !== s.id}
                  onPress={() => {
                    setSelected(s.id);
                    setDetails({});
                    setError("");
                  }}
                />
              ))}
          </Row>
          <Input
            label={
              monthly
                ? "Cleaning preferences and preferred days"
                : "Work required"
            }
            value={description}
            onChangeText={setDescription}
            multiline
          />
          {selectedService?.bookingFields?.map((field) => (
            <React.Fragment key={field.id}>
              <Input
                label={
                  field.label + (field.required ? " (required)" : " (optional)")
                }
                value={details[field.id] || ""}
                onChangeText={(value) =>
                  setDetails((previous) => ({ ...previous, [field.id]: value }))
                }
                placeholder={field.placeholder}
                maxLength={300}
              />
              {!!field.help && (
                <T size={12} color={c.muted}>
                  {field.help}
                </T>
              )}
            </React.Fragment>
          ))}
          {state?.addresses.map((address) => (
            <Button
              key={address.id}
              secondary
              label={address.label + " · " + address.line}
              onPress={() => {
                setLine(address.line);
                setPin(address.pin);
              }}
            />
          ))}
          <Input label="Service address" value={line} onChangeText={setLine} />
          <Input
            label="PIN code"
            value={pin}
            onChangeText={setPin}
            keyboardType="number-pad"
          />
          <T size={12} color={c.muted}>
            Service area PINs:{" "}
            {allowedPins.join(", ") || "Contact support for availability"}
          </T>
          {!!pin && pin.length === 6 && !allowedPins.includes(pin) && (
            <T color={c.red}>This service is unavailable for that PIN code.</T>
          )}
          <Button
            label={monthly ? "Send monthly plan request" : "Send quote request"}
            disabled={
              busy ||
              !!missingDetail ||
              !selected ||
              description.trim().length < 15 ||
              line.trim().length < 8 ||
              !allowedPins.includes(pin)
            }
            onPress={() =>
              void request("/service-quotes", {
                idempotencyKey: sendKey,
                serviceId: selected,
                details,
                description,
                address: { line, pin, label: chosenAddress?.label || "Home" },
              })
                .then(() => {
                  setDescription("");
                  setDetails({});
                  setSendKey(
                    "quote-" +
                      Date.now() +
                      "-" +
                      Math.random().toString(36).slice(2),
                  );
                  return load();
                })
                .catch((e) => setError((e as Error).message))
            }
          />
        </Card>
      )}
      {!error && rows.length === 0 && (
        <T color={c.muted}>
          {quoteId ? "Loading quote…" : "No quote requests yet."}
        </T>
      )}
      {rows.map((q) => (
        <QuoteCard key={q.id} quote={q} reload={load} />
      ))}
      {!!cursor && (
        <Button
          label="Load older quotes"
          secondary
          onPress={() =>
            void read<{ rows: Quote[]; nextCursor: unknown }>(
              "/service-quotes?cursor=" + encodeURIComponent(String(cursor)),
            )
              .then((data) => {
                setRows((old) => [...old, ...data.rows]);
                setCursor(
                  data.nextCursor ? JSON.stringify(data.nextCursor) : null,
                );
              })
              .catch((e) => setError((e as Error).message))
          }
        />
      )}
    </>
  );
  return embedded ? (
    content
  ) : (
    <Shell title="My quotes" back>
      {content}
    </Shell>
  );
}
function QuoteCard({
  quote: q,
  reload,
}: {
  quote: Quote;
  reload: () => Promise<void>;
}) {
  const { state, request, busy, lang } = useApp();
  const customer = state?.user.role === "customer",
    owner = state?.user.role === "owner";
  const monthly = q.billingPeriod === "monthly";
  const previousOffering =
    !monthly &&
    !q.bookingId &&
    state?.services.some(
      (s) => s.id === q.serviceId && s.billingPeriod === "monthly",
    );
  const [price, setPrice] = useState(""),
    [scope, setScope] = useState(q.description),
    [duration, setDuration] = useState("60"),
    [validSlot, setValidSlot] = useState(false),
    [slot, setSlot] = useState(() => slots()[0]),
    [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const action = (name: string) =>
    void request("/service-quotes/" + q.id + "/" + name, {
      revision: q.revision,
    })
      .then(reload)
      .catch((e) => setError((e as Error).message));
  return (
    <Card>
      {!!error && (
        <T accessibilityRole="alert" color={c.red}>
          {error}
        </T>
      )}
      <T bold size={20}>
        {q.serviceName}
      </T>
      {monthly && (
        <T bold color={c.green}>
          Monthly subscription
        </T>
      )}
      {previousOffering && (
        <T>Car Care now uses monthly plans. Please send a new request.</T>
      )}
      <T color={c.muted}>
        {q.status.replaceAll("_", " ")} · Revision {q.revision}
      </T>
      {!customer && <T>{q.customerName}</T>}
      <T>{q.description}</T>
      {q.serviceDetails?.map((answer) => (
        <T key={answer.id}>{answer.label + ": " + answer.value}</T>
      ))}
      <T>
        {q.address.line} · {q.address.pin}
      </T>
      {q.items?.map((item, i) => (
        <T key={i}>
          {item.quantity} × {item.label} ·{" "}
          {money(item.quantity * item.unitPrice)}
        </T>
      ))}
      {q.total !== undefined && (
        <>
          <T bold size={22}>
            {money(q.total)}
            {monthly && " · "}
            {monthly && "per month"}
          </T>
          <T>{q.scope}</T>
          <T color={c.muted}>
            Valid until{" "}
            {new Date(q.expiresAt!).toLocaleString(
              lang === "te" ? "te-IN" : "en-IN",
              { timeZone: "Asia/Kolkata" },
            )}
          </T>
        </>
      )}
      {owner &&
        !previousOffering &&
        ["requested", "proposed"].includes(q.status) && (
          <>
            <Input
              label={
                monthly
                  ? "Monthly price (whole rupees, including taxes)"
                  : "Total price (whole rupees, including taxes)"
              }
              value={price}
              onChangeText={setPrice}
              keyboardType="number-pad"
            />
            <Input
              label={
                monthly
                  ? "Visits per month, work included and plan terms"
                  : "Approved scope and exclusions"
              }
              value={scope}
              onChangeText={setScope}
              multiline
            />
            {!monthly && (
              <Input
                label="Work duration in minutes (30–240, steps of 30)"
                value={duration}
                onChangeText={setDuration}
                keyboardType="number-pad"
              />
            )}
            <Button
              label="Send proposal"
              disabled={
                busy || !Number.isInteger(Number(price)) || Number(price) < 1
              }
              onPress={() =>
                void request("/service-quotes/" + q.id + "/propose", {
                  revision: q.revision,
                  items: [
                    {
                      label: q.serviceName,
                      quantity: 1,
                      unitPrice: Number(price),
                    },
                  ],
                  scope,
                  ...(monthly ? {} : { duration: Number(duration) }),
                  expiresAt: Date.now() + 7 * 86400000,
                })
                  .then(reload)
                  .catch((e) => setError((e as Error).message))
              }
            />
          </>
        )}
      {customer && !previousOffering && q.status === "proposed" && (
        <Button
          label={
            monthly ? "Accept monthly proposal" : "Accept this scope and price"
          }
          disabled={busy || q.expiresAt! <= now}
          onPress={() => action("accept")}
        />
      )}
      {customer && monthly && q.status === "accepted" && (
        <T>
          Proposal accepted. The team will contact you to confirm your start
          date and payment arrangements.
        </T>
      )}
      {customer && !monthly && !previousOffering && q.status === "accepted" && (
        <>
          <T bold>Select a visit time</T>
          <SlotPicker
            value={slot}
            onChange={setSlot}
            onValidityChange={setValidSlot}
            serviceId={q.serviceId}
            quoteId={q.id}
            pin={q.address.pin}
          />
          <T color={c.muted}>
            Availability is confirmed when you reserve. Payment must be
            completed within 15 minutes.
          </T>
          <Button
            label="Reserve and continue to payment"
            disabled={!validSlot || busy || q.expiresAt! <= now}
            onPress={() =>
              void request<{ id: string }>("/bookings", {
                serviceId: q.serviceId,
                quoteId: q.id,
                expectedTotal: q.total,
                address: q.address,
                slot,
                idempotencyKey: "quote-" + q.id,
              })
                .then((b) => router.push(("/booking/" + b.id) as never))
                .catch((e) => setError((e as Error).message))
            }
          />
        </>
      )}
      {customer && ["requested", "proposed", "accepted"].includes(q.status) && (
        <Button
          label="Decline request"
          secondary
          disabled={busy}
          onPress={() => action("decline")}
        />
      )}
      {owner && ["requested", "proposed", "accepted"].includes(q.status) && (
        <Button
          label="Withdraw quote"
          secondary
          disabled={busy}
          onPress={() => action("withdraw")}
        />
      )}
      {!!q.bookingId && (
        <>
          <T color={c.muted}>
            This quote is linked to one booking. If an unpaid reservation
            expires or is cancelled, request a fresh quote for a new
            reservation.
          </T>
          <Button
            label="Request fresh work from this service"
            secondary
            onPress={() => router.push(("/service/" + q.serviceId) as never)}
          />
        </>
      )}
      {!!q.bookingId && (
        <Button
          label="Open booking"
          secondary
          onPress={() => router.push(("/booking/" + q.bookingId) as never)}
        />
      )}
    </Card>
  );
}
