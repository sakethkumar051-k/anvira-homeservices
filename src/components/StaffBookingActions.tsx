import { useState } from "react";
import { View } from "react-native";
import * as Linking from "expo-linking";
import { useApp } from "../lib/context";
import { Booking } from "../lib/model";
import { dispatchSummary } from "../lib/dispatch";
import { Badge, Button, Card, Input, T, c } from "./ui";

export function StaffBookingActions({
  booking: b,
  onUpdate,
}: {
  booking: Booking;
  onUpdate: (booking: Booking) => void;
}) {
  const { state, request, busy } = useApp();
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  if (!state || !["owner", "care"].includes(state.user.role) || !b.dispatch)
    return null;
  if (
    b.payment !== "paid" ||
    b.refund ||
    !["awaiting_assignment", "assigned", "confirmed", "in_progress"].includes(
      b.status,
    )
  )
    return null;
  const summary = dispatchSummary(b, "staff");
  const assigned = state.professionals.find((p) => p.id === b.professionalId);
  const canAssign =
    ["awaiting_assignment", "assigned", "confirmed"].includes(b.status) &&
    !b.arrivedAt;
  const candidates = state.professionals.filter(
    (p) =>
      p.type === "In-house" &&
      p.approved &&
      p.active !== false &&
      p.available !== false &&
      p.skills.includes(b.serviceId) &&
      p.pins?.includes(b.address.pin) &&
      p.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  async function action(action: string, extra = {}) {
    setError("");
    try {
      onUpdate(
        await request<Booking>("/bookings/" + b.id + "/action", {
          action,
          revision: b.dispatch?.revision,
          ...extra,
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Card style={{ backgroundColor: c.ivory }}>
      <T bold size={20}>
        Office dispatch
      </T>
      {!!summary && (
        <>
          <Badge
            label={summary.label}
            tone={summary.attention ? "amber" : "green"}
          />
          <T>{summary.detail}</T>
        </>
      )}
      {!!assigned && (
        <T bold>{"Assigned: " + assigned.name + " · " + assigned.type}</T>
      )}
      {!!assigned?.phone && assigned.type === "In-house" && (
        <Button
          label="Call internal worker"
          secondary
          onPress={() =>
            void Linking.openURL("tel:" + assigned.phone).catch(() =>
              setError(
                "This device cannot place calls. Use the worker contact in the office roster.",
              ),
            )
          }
        />
      )}
      {b.professionalType === "In-house" &&
        b.status === "confirmed" &&
        b.dispatch.state === "assigned" && (
          <Button
            label="Mark team dispatched"
            disabled={busy}
            onPress={() => void action("dispatch")}
          />
        )}
      {canAssign && (
        <View style={{ gap: 10 }}>
          <T bold>
            {b.professionalId
              ? "Change internal worker"
              : "Assign an internal worker"}
          </T>
          <T size={12} color={c.muted}>
            Availability and time conflicts are checked again when you assign.
          </T>
          {(candidates.length > 5 || !!search) && (
            <Input
              label="Find internal worker"
              value={search}
              onChangeText={setSearch}
              maxLength={100}
            />
          )}
          {!candidates.length && (
            <T color={c.muted}>
              No available internal workers match this service and PIN. Check
              the roster and coverage.
            </T>
          )}
          {candidates.slice(0, 20).map((worker) => (
            <Button
              key={worker.id}
              label={"Assign " + worker.name}
              secondary
              disabled={busy || b.professionalId === worker.id}
              onPress={() =>
                void action("assign", { professionalId: worker.id })
              }
            />
          ))}
          {candidates.length > 20 && (
            <T size={12}>
              Showing the first 20 matches. Search to find another worker.
            </T>
          )}
          {state.settings.externalPartnersEnabled &&
            state.services.find((service) => service.id === b.serviceId)
              ?.partnerFulfillmentAllowed !== false && (
              <>
                <T size={12} color={c.muted}>
                  Partner offers are available only when no internal worker can
                  cover this time.
                </T>
                <Button
                  label={
                    b.dispatch.state === "offering"
                      ? "Restart partner offers"
                      : "Offer to available partners"
                  }
                  secondary
                  disabled={busy || !!b.arrivedAt}
                  onPress={() => void action("offer_partners")}
                />
              </>
            )}
          {!state.settings.externalPartnersEnabled && (
            <T size={12} color={c.muted}>
              External partner fallback is off. The Owner can enable it on the
              website.
            </T>
          )}
        </View>
      )}
      {!!error && (
        <T accessibilityRole="alert" color={c.red}>
          {error}
        </T>
      )}
    </Card>
  );
}
