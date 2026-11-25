import React, { useEffect, useState } from "react";
import { AppState, Platform, View } from "react-native";
import { useIsFocused } from "expo-router";
import { useApp } from "../lib/context";
import { Booking, dateLabel } from "../lib/model";
import {
  dispatchReasons,
  dispatchStages,
  pushStates,
} from "../lib/dispatch-copy";
import { Card, T, Row, Badge, Button, c } from "./ui";
type Snapshot = {
  progress: Booking["dispatchProgress"];
  limited: boolean;
  candidates: { id: string; name: string; type: string; reason: string }[];
  offers: {
    id: string;
    name: string;
    status: string;
    pushStatus: string;
    expiresAt: number;
  }[];
};
export default function DispatchInspector({ booking }: { booking: Booking }) {
  const focused = useIsFocused();
  const { read, state } = useApp();
  const [value, setValue] = useState<Snapshot | null>(null),
    [error, setError] = useState(""),
    [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!focused) return;
    let active = true;
    const load = () =>
      void read<Snapshot>("/bookings/" + booking.id + "/dispatch")
        .then((v) => {
          if (active) {
            setValue(v);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    load();
    const timer = setInterval(() => {
      if (
        AppState.currentState === "active" &&
        (Platform.OS !== "web" || !document.hidden)
      )
        load();
    }, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [read, booking.id, state?.user.id, focused]);
  const progress = value?.progress;
  return (
    <Card>
      <Row style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <T bold size={19}>
          Dispatch progress
        </T>
        <Badge label={progress ? "Automatic dispatch" : "Manual dispatch"} />
      </Row>
      {!!error && <T color={c.red}>{error}</T>}
      {!!progress && (
        <>
          <T bold>{dispatchReasons[progress.reason] || progress.reason}</T>
          <T size={12} color={c.muted}>
            Outside offer round {progress.round} / 2 · Deadline{" "}
            {dateLabel(progress.deadlineAt)}
          </T>
          {progress.history.map((step, index) => (
            <Row key={index} style={{ alignItems: "flex-start" }}>
              <T size={12} color={c.green}>
                {String(index + 1).padStart(2, "0")}
              </T>
              <View style={{ flex: 1 }}>
                <T>{dispatchStages[step.stage] || step.stage}</T>
                <T size={11} color={c.muted}>
                  {dateLabel(step.at)}
                </T>
              </View>
            </Row>
          ))}
          {progress.reason === "NO_PARTNER_ACCEPTED" ||
          progress.reason === "NO_ELIGIBLE_PARTNERS" ? (
            <T color={c.amber}>
              Contact the customer, review the roster or offer a new time. No
              refund or cancellation is automatic.
            </T>
          ) : null}
        </>
      )}
      <Button
        label={expanded ? "Hide matching details" : "Why this assignment?"}
        secondary
        onPress={() => setExpanded(!expanded)}
      />
      {expanded && (
        <>
          <T bold>Team eligibility</T>
          {value?.limited && (
            <T size={12} color={c.muted}>
              Showing the first 200 roster records. Dispatch matching checks the
              full approved roster.
            </T>
          )}
          {value?.candidates.map((p) => (
            <View
              key={p.id}
              style={{
                paddingVertical: 8,
                borderBottomWidth: 1,
                borderBottomColor: c.line,
                gap: 4,
              }}
            >
              <T bold>
                {p.name} · {p.type}
              </T>
              <T size={12} color={p.reason === "ELIGIBLE" ? c.green : c.muted}>
                {dispatchReasons[p.reason] || p.reason}
              </T>
            </View>
          ))}
          <T bold>Outside offers and alerts</T>
          {!value?.offers.length && (
            <T color={c.muted}>
              No outside offers have been sent for this visit.
            </T>
          )}
          {value?.offers.map((o) => (
            <View key={o.id} style={{ gap: 4, paddingVertical: 8 }}>
              <T bold>{o.name}</T>
              <T>
                {o.status} · {pushStates[o.pushStatus] || o.pushStatus}
              </T>
            </View>
          ))}
          <T size={12} color={c.muted}>
            A push provider receipt does not confirm that the professional saw
            the alert. Acceptance confirms the assignment.
          </T>
        </>
      )}
    </Card>
  );
}
