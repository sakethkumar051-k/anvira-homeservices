import React, { useState } from "react";
import { View } from "react-native";
import { useApp } from "../lib/context";
import { dispatchReasons, dispatchStages } from "../lib/dispatch-copy";
import { Card, T, Button, Row, Badge, c } from "./ui";
type Result = {
  simulation: true;
  realNotificationsSent: number;
  state: string;
  reason: string;
  round: number;
  delivery: string;
  acceptedCount: number;
  history: { stage: string; at: number }[];
  offers: { professional: string; status: string; round: number }[];
  notificationPreview: { title: string; body: string };
};
const scenarios = [
  ["internal", "ANVIRA worker available"],
  ["external", "ANVIRA unavailable · outside accepts"],
  ["busy", "No eligible team available"],
  ["race", "Two professionals accept together"],
  ["timeout", "Nobody accepts · show escalation"],
  ["notification_failure", "Push notification fails"],
];
export default function DispatchSimulator() {
  const { request, state } = useApp();
  const [scenario, setScenario] = useState("external"),
    [result, setResult] = useState<Result | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [serviceId, setServiceId] = useState(
    state?.services.find((s) => s.active && s.billingPeriod !== "monthly")
      ?.id || "",
  );
  return (
    <>
      <Card style={{ backgroundColor: c.mint }}>
        <Badge label="Simulation · no real orders or alerts" />
        <T size={21} bold>
          Try the dispatch flow
        </T>
        <T>
          Use sample professionals to see what happens after payment. This does
          not change your team, send real notifications or take payments.
        </T>
      </Card>
      <Card>
        <T bold>1. Choose an example service</T>
        <Row style={{ flexWrap: "wrap" }}>
          {state?.services
            .filter((s) => s.active && s.billingPeriod !== "monthly")
            .map((s) => (
              <Button
                key={s.id}
                label={s.name}
                secondary={serviceId !== s.id}
                disabled={busy}
                onPress={() => {
                  setServiceId(s.id);
                  setResult(null);
                }}
              />
            ))}
        </Row>
        <T bold>2. Choose what happens</T>
        {scenarios.map(([id, label]) => (
          <Button
            key={id}
            label={label}
            secondary={scenario !== id}
            disabled={busy}
            onPress={() => {
              setScenario(id);
              setResult(null);
            }}
          />
        ))}
        {!!error && (
          <T color={c.red} accessibilityRole="alert">
            {error}
          </T>
        )}
        <Button
          label="Run dispatch simulation"
          loading={busy}
          onPress={() => {
            setBusy(true);
            setError("");
            setResult(null);
            void request<Result>("/dispatch/simulate", {
              scenario,
              ...(serviceId ? { serviceId } : {}),
            })
              .then(setResult)
              .catch((e) => setError(e.message))
              .finally(() => setBusy(false));
          }}
        />
      </Card>
      {!!result && (
        <Card>
          <T bold size={20}>
            Simulation result
          </T>
          <Badge label={dispatchStages[result.state] || result.state} />
          <T>{dispatchReasons[result.reason] || result.reason}</T>
          <T size={12} color={c.muted}>
            Example professionals and prices are used. No real notification was
            sent.
          </T>
          <T bold>What the admin sees</T>
          {result.history.map((step, i) => (
            <T key={i}>
              {i + 1}. {dispatchStages[step.stage] || step.stage}
            </T>
          ))}
          <T bold>What outside professionals see</T>
          {!result.offers.length ? (
            <T>No outside offer was needed.</T>
          ) : (
            <View
              style={{
                backgroundColor: c.ivory,
                padding: 16,
                borderRadius: 12,
                gap: 6,
              }}
            >
              <T bold>{result.notificationPreview.title}</T>
              <T>{result.notificationPreview.body}</T>
              <T size={12}>
                Open the professional app to view the service, time, area and
                net earnings, then accept or decline.
              </T>
            </View>
          )}
          {result.offers.map((offer, i) => (
            <T key={i}>
              {offer.professional} · {offer.status}
            </T>
          ))}
          {result.delivery === "failed_simulated" && (
            <T color={c.amber}>
              Simulated push failure: the job remains in the offer inbox until
              expiry. Delivery retries do not extend its deadline.
            </T>
          )}
          {scenario === "race" && (
            <T bold>Only one professional can win this booking.</T>
          )}
        </Card>
      )}
    </>
  );
}
