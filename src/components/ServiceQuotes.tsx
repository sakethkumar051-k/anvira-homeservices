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
};
export function ServiceQuotes({ embedded = false }: { embedded?: boolean }) {
  const { state, read, request, busy } = useApp();
  const { serviceId } = useLocalSearchParams<{ serviceId?: string }>();
  const [rows, setRows] = useState<Quote[]>([]),
    [cursor, setCursor] = useState<number | string | null>(null),
    [error, setError] = useState("");
  const [sendKey, setSendKey] = useState(
    () => "quote-" + Date.now() + "-" + Math.random().toString(36).slice(2),
  );
  const [description, setDescription] = useState(""),
    [line, setLine] = useState(""),
    [pin, setPin] = useState(""),
    [selected, setSelected] = useState(serviceId || "");
  const load = useCallback(async () => {
    try {
      const data = await read<{ rows: Quote[]; nextCursor: unknown }>(
        "/service-quotes",
      );
      setRows(data.rows);
      setCursor(data.nextCursor ? JSON.stringify(data.nextCursor) : null);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [read]);
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
      {customer && (
        <Card>
          <T bold size={20}>
            Request a tailored quote
          </T>
          <T color={c.muted}>
            Describe work outside a standard package. Review the final scope and
            price before booking. No payment is taken for a request.
          </T>
          <Row style={{ flexWrap: "wrap" }}>
            {state?.services
              .filter((s) => s.active)
              .map((s) => (
                <Button
                  key={s.id}
                  label={s.name}
                  secondary={selected !== s.id}
                  onPress={() => setSelected(s.id)}
                />
              ))}
          </Row>
          <Input
            label="Work required"
            value={description}
            onChangeText={setDescription}
            multiline
          />
          <Input label="Service address" value={line} onChangeText={setLine} />
          <Input
            label="PIN code"
            value={pin}
            onChangeText={setPin}
            keyboardType="number-pad"
          />
          <Button
            label="Send quote request"
            disabled={
              busy ||
              !selected ||
              description.trim().length < 15 ||
              line.trim().length < 8 ||
              !/^\d{6}$/.test(pin)
            }
            onPress={() =>
              void request("/service-quotes", {
                idempotencyKey: sendKey,
                serviceId: selected,
                description,
                address: { line, pin, label: "Home" },
              })
                .then(() => {
                  setDescription("");
                  setSendKey(
                    "quote-" +
                      Date.now() +
                      "-" +
                      Math.random().toString(36).slice(2),
                  );
                  return load();
                })
                .catch(() => {})
            }
          />
        </Card>
      )}
      {rows.length === 0 && <T color={c.muted}>No quote requests yet.</T>}
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
  const { state, request, busy } = useApp();
  const customer = state?.user.role === "customer",
    owner = state?.user.role === "owner";
  const [price, setPrice] = useState(""),
    [scope, setScope] = useState(q.description),
    [duration, setDuration] = useState("60"),
    [slot, setSlot] = useState(() => slots()[0]),
    [details, setDetails] = useState<Record<string, string>>({});
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const service = state?.services.find((s) => s.id === q.serviceId);
  const action = (name: string) =>
    void request("/service-quotes/" + q.id + "/" + name, {
      revision: q.revision,
    })
      .then(reload)
      .catch(() => {});
  return (
    <Card>
      <T bold size={20}>
        {q.serviceName}
      </T>
      <T color={c.muted}>
        {q.status.replaceAll("_", " ")} · Revision {q.revision}
      </T>
      {!customer && <T>{q.customerName}</T>}
      <T>{q.description}</T>
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
          </T>
          <T>{q.scope}</T>
          <T color={c.muted}>
            Valid until {new Date(q.expiresAt!).toLocaleString()}
          </T>
        </>
      )}
      {owner && ["requested", "proposed"].includes(q.status) && (
        <>
          <Input
            label="Total price (whole rupees, including taxes)"
            value={price}
            onChangeText={setPrice}
            keyboardType="number-pad"
          />
          <Input
            label="Approved scope and exclusions"
            value={scope}
            onChangeText={setScope}
            multiline
          />
          <Input
            label="Work duration in minutes (30–240, steps of 30)"
            value={duration}
            onChangeText={setDuration}
            keyboardType="number-pad"
          />
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
                duration: Number(duration),
                expiresAt: Date.now() + 7 * 86400000,
              })
                .then(reload)
                .catch(() => {})
            }
          />
        </>
      )}
      {customer && q.status === "proposed" && (
        <Button
          label="Accept this scope and price"
          disabled={busy || q.expiresAt! <= now}
          onPress={() => action("accept")}
        />
      )}
      {customer && q.status === "accepted" && (
        <>
          <T bold>Select a visit time</T>
          <SlotPicker value={slot} onChange={setSlot} />
          <T color={c.muted}>
            Availability is confirmed when you reserve. Payment must be
            completed within 15 minutes.
          </T>
          {service?.bookingFields?.map((f) => (
            <Input
              key={f.id}
              label={f.label + (f.required ? " *" : "")}
              value={details[f.id] || ""}
              onChangeText={(v) => setDetails((old) => ({ ...old, [f.id]: v }))}
            />
          ))}
          <Button
            label="Reserve and continue to payment"
            disabled={busy || q.expiresAt! <= now}
            onPress={() =>
              void request<{ id: string }>("/bookings", {
                serviceId: q.serviceId,
                quoteId: q.id,
                address: q.address,
                details,
                slot,
                idempotencyKey: "quote-" + q.id,
              })
                .then((b) => router.push(("/booking/" + b.id) as never))
                .catch(() => {})
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
