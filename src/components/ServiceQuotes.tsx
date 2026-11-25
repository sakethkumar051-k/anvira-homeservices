import { quoteValidation } from "../lib/form-validation";
import { SectionHeading } from "./MobileUI";
import { availableServicePins } from "../lib/service-catalog";
import { ScrollView, TextInput } from "react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
  const [filter, setFilter] = useState("all");
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
  const [submitted, setSubmitted] = useState(false),
    [notice, setNotice] = useState("");
  const fieldRefs = useRef<
    Record<string, React.ComponentRef<typeof TextInput> | null>
  >({});
  const validation = quoteValidation({
    service: selectedService,
    description,
    line,
    pin,
    allowedPins,
    details,
  });
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
      <SectionHeading
        title={
          monthly && customer
            ? "Monthly Car Care"
            : customer
              ? "Your quotes"
              : "Customer quote requests"
        }
        detail="Review the scope and price before accepting"
        action="Refresh quotes"
        onPress={() => void load()}
      />
      {!!quoteId && (
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
          {!!notice && (
            <T color={c.green} accessibilityLiveRegion="polite">
              {notice}
            </T>
          )}
          {submitted && Object.keys(validation).length > 0 && (
            <T color={c.red} accessibilityRole="alert">
              Please complete the highlighted fields below. No request has been
              sent.
            </T>
          )}
          {submitted && !!validation.service && (
            <T color={c.red}>{validation.service}</T>
          )}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Row style={{ gap: 8 }}>
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
                      setNotice("");
                      setSubmitted(false);
                      setError("");
                    }}
                  />
                ))}
            </Row>
          </ScrollView>
          <Input
            label={
              monthly
                ? "Cleaning preferences and preferred days"
                : "Work required"
            }
            inputRef={(ref) => {
              fieldRefs.current.description = ref;
            }}
            error={submitted ? validation.description : undefined}
            help="At least 15 characters. Tell us the work and days you prefer."
            maxLength={2000}
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
                inputRef={(ref) => {
                  fieldRefs.current[field.id] = ref;
                }}
                error={
                  submitted && validation[field.id]
                    ? details[field.id]?.trim().length > 300
                      ? "Use no more than 300 characters."
                      : "Enter at least 2 characters for this required field."
                    : undefined
                }
                help={
                  field.required
                    ? "Required · at least 2 characters"
                    : "Optional"
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
          <Input
            label="Service address"
            value={line}
            onChangeText={setLine}
            maxLength={300}
            inputRef={(ref) => {
              fieldRefs.current.line = ref;
            }}
            error={submitted ? validation.line : undefined}
            help="House number, street and area · at least 8 characters"
          />
          <Input
            label="PIN code"
            inputRef={(ref) => {
              fieldRefs.current.pin = ref;
            }}
            error={submitted || pin.length === 6 ? validation.pin : undefined}
            maxLength={6}
            value={pin}
            onChangeText={setPin}
            keyboardType="number-pad"
          />
          <T size={12} color={c.muted}>
            Service area PINs:{" "}
            {allowedPins.join(", ") || "Contact support for availability"}
          </T>
          <Button
            label={monthly ? "Send monthly plan request" : "Send quote request"}
            loading={busy}
            onPress={() => {
              setSubmitted(true);
              setNotice("");
              setError("");
              const first = Object.keys(validation)[0];
              if (first) {
                fieldRefs.current[first]?.focus();
                return;
              }
              void request("/service-quotes", {
                idempotencyKey: sendKey,
                serviceId: selected,
                details,
                description: description.trim(),
                address: {
                  line: line.trim(),
                  pin: pin.trim(),
                  label: chosenAddress?.label || "Home",
                },
              })
                .then(() => {
                  setDescription("");
                  setDetails({});
                  setSubmitted(false);
                  setNotice(
                    monthly
                      ? "Monthly plan request sent. The team will confirm the price and schedule. No payment has been taken."
                      : "Quote request sent. The team will review your requirement. No payment has been taken.",
                  );
                  setSendKey(
                    "quote-" +
                      Date.now() +
                      "-" +
                      Math.random().toString(36).slice(2),
                  );
                  return load();
                })
                .catch((e) => setError((e as Error).message));
            }}
          />
        </Card>
      )}
      {!error && rows.length === 0 && (
        <T color={c.muted}>
          {quoteId ? "Loading quote…" : "No quote requests yet."}
        </T>
      )}
      {!customer && !quoteId && (
        <>
          <Row style={{ flexWrap: "wrap" }}>
            {[
              ["all", "All quotes"],
              ["requested", "Needs proposal"],
              ["proposed", "Awaiting customer"],
              ["accepted", "Accepted"],
            ].map(([key, label]) => (
              <Button
                key={key}
                label={label}
                secondary={filter !== key}
                onPress={() => setFilter(key)}
              />
            ))}
          </Row>
          <T size={12} color={c.muted}>
            Filters apply to loaded requests. Load older quotes to review more.
          </T>
        </>
      )}
      {rows
        .filter((q) => customer || filter === "all" || q.status === filter)
        .map((q) => (
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
  const [editing, setEditing] = useState(false);
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
          <Button
            label={editing ? "Close proposal editor" : "Prepare proposal"}
            secondary
            onPress={() => setEditing(!editing)}
          />
        )}
      {owner &&
        editing &&
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
              disabledReason={
                busy
                  ? "Please wait for the current update to finish."
                  : "Enter a valid whole-rupee price of at least ₹1 before sending the proposal."
              }
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
          disabledReason={
            busy
              ? "Please wait for the current update to finish."
              : "This proposal has expired. Ask the team to send a new proposal."
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
            disabledReason={
              busy
                ? "Please wait for the current update to finish."
                : "Choose an available time. If the proposal has expired, ask the team for a new one."
            }
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
