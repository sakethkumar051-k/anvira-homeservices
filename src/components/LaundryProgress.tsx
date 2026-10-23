import { useState } from "react";
import { Booking, dateLabel } from "../lib/model";
import { useApp } from "../lib/context";
import { Card, T, Input, Button, c } from "./ui";
const stages = [
  "collected",
  "received",
  "processing",
  "ready",
  "out_for_delivery",
  "delivered",
];
const names = [
  "Collected",
  "Received at laundry",
  "Cleaning in progress",
  "Ready for delivery",
  "Out for delivery",
  "Delivered",
];
export function LaundryProgress({
  booking: b,
  onUpdate,
}: {
  booking: Booking;
  onUpdate: (b: Booking) => void;
}) {
  const { state, request, busy, lang } = useApp();
  const [note, setNote] = useState("");
  const [returnOpen, setReturnOpen] = useState(false);
  if (b.fulfillmentType !== "laundry") return null;
  const next = b.laundry?.history.length || 0,
    canUpdate =
      ["owner", "care", "professional"].includes(state?.user.role || "") &&
      b.status === "in_progress" &&
      b.payment === "paid" &&
      next < stages.length;
  return (
    <Card>
      <T bold size={20}>
        Laundry tracking
      </T>
      {!b.laundry && (
        <T color={c.muted}>
          Collection begins after the professional starts the paid job.
        </T>
      )}
      {b.laundry?.history.map((event, i) => (
        <T key={event.stage}>
          {i + 1}. {names[i]} · {dateLabel(event.at, lang)}
          {"\n"}
          {event.note}
        </T>
      ))}
      {b.laundry?.stage === "returned" && (
        <T>
          Items returned · {b.laundry.returnNote} · Refund awaiting Owner review
        </T>
      )}
      {canUpdate && (
        <>
          <Input
            label={
              next === 5
                ? "Delivery recipient and handover details"
                : "Item count, bag reference or progress note"
            }
            value={note}
            onChangeText={setNote}
          />
          <Button
            label={"Mark " + names[next].toLowerCase()}
            disabled={busy || note.trim().length < 3}
            onPress={() =>
              void request<Booking>("/bookings/" + b.id + "/action", {
                action: "laundry",
                stage: stages[next],
                revision: b.laundry?.revision || 0,
                note,
              })
                .then((updated) => {
                  onUpdate(updated);
                  setNote("");
                })
                .catch(() => {})
            }
          />
        </>
      )}
      {canUpdate &&
        next === 0 &&
        ["owner", "care"].includes(state?.user.role || "") && (
          <>
            <Button
              label="Cancel before collection"
              secondary
              onPress={() => setReturnOpen(!returnOpen)}
            />
            {returnOpen && (
              <>
                <T>
                  Confirm no items have been collected. This cancels the job and
                  requests an Owner-reviewed refund.
                </T>
                <Button
                  label="Confirm cancellation before collection"
                  danger
                  disabled={busy}
                  onPress={() =>
                    void request<Booking>("/bookings/" + b.id + "/action", {
                      action: "cancel",
                    })
                      .then(onUpdate)
                      .catch(() => {})
                  }
                />
              </>
            )}
          </>
        )}
      {canUpdate &&
        next > 0 &&
        ["owner", "care"].includes(state?.user.role || "") && (
          <>
            <Button
              label="Record return without service"
              secondary
              onPress={() => setReturnOpen(!returnOpen)}
            />
            {returnOpen && (
              <>
                <T color={c.muted}>
                  Use only after items have physically been returned to the
                  customer. This cancels the job and requests an Owner-reviewed
                  refund. Lost/damaged items require a separate support case.
                </T>
                <Input
                  label="Return recipient, reason and handover details"
                  value={note}
                  onChangeText={setNote}
                />
                <Button
                  label="Confirm items returned and request refund"
                  danger
                  disabled={busy || note.trim().length < 10}
                  onPress={() =>
                    void request<Booking>("/bookings/" + b.id + "/action", {
                      action: "laundry_return",
                      revision: b.laundry?.revision,
                      returned: true,
                      note,
                    })
                      .then(onUpdate)
                      .catch(() => {})
                  }
                />
              </>
            )}
          </>
        )}
    </Card>
  );
}
