import DispatchSimulator from "./DispatchSimulator";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useApp } from "../lib/context";
import { Card, T, Row, Badge, Button, c } from "./ui";
type Health = {
  checkedAt: number;
  dispatchWorkerStatus?: { lastRunAt: number | null; ok: boolean };
  workerStatus?: { lastRunAt: number | null; ok: boolean };
  checks: { name: string; ready: boolean }[];
  overdueTickets: number;
  financialExceptions: number;
};
export default function Automations() {
  const { read, state } = useApp();
  const [view, setView] = useState("monitor");
  const [health, setHealth] = useState<Health | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    void read<Health>("/operations/readiness")
      .then((value) => {
        if (current) {
          setHealth(value);
          setError("");
        }
      })
      .catch((e) => {
        if (current) {
          setError(e.message);
          setHealth(null);
        }
      });
    return () => {
      current = false;
    };
  }, [read, state]);
  const healthy = health?.checks.find(
    (check) => check.name === "Background jobs",
  )?.ready;
  const go = (tab: string) => router.push(("/dashboard/" + tab) as never);
  return (
    <>
      <Row style={{ flexWrap: "wrap" }}>
        <Button
          label="Automation status"
          secondary={view !== "monitor"}
          onPress={() => setView("monitor")}
        />
        <Button
          label="Dispatch simulator"
          secondary={view !== "simulate"}
          onPress={() => setView("simulate")}
        />
      </Row>
      {view === "simulate" ? (
        <DispatchSimulator />
      ) : (
        <>
          <Card style={{ backgroundColor: healthy ? c.mint : c.amberbg }}>
            <Row style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
              <T size={21} bold>
                Background work
              </T>
              <Badge
                label={
                  error
                    ? "Unable to check"
                    : !health
                      ? "Checking…"
                      : healthy
                        ? "Recent run confirmed"
                        : "Needs attention"
                }
                tone={healthy ? "green" : "amber"}
              />
            </Row>
            {!!error && <T color={c.red}>{error}</T>}
            <T>
              {!health
                ? "Waiting for the server’s job status."
                : healthy
                  ? "The server recorded a successful background run within the last 10 minutes."
                  : "A recent successful background run has not been confirmed. Check hosting and job scheduling."}
            </T>
            <T size={12} color={c.muted}>
              {health?.workerStatus?.lastRunAt
                ? "Last run: " +
                  new Date(health.workerStatus.lastRunAt).toLocaleString(
                    "en-IN",
                    {
                      timeZone: "Asia/Kolkata",
                    },
                  ) +
                  " IST"
                : "Last run: not available"}
            </T>
            <Badge
              label={
                health?.dispatchWorkerStatus?.ok
                  ? "Dispatch timer active"
                  : "Dispatch timer not confirmed"
              }
              tone={health?.dispatchWorkerStatus?.ok ? "green" : "amber"}
            />
            <T size={12} color={c.muted}>
              Automatic retries require the server scheduler. Closing this site
              does not stop it; a sleeping or stopped backend can delay it.
            </T>
            <T size={12} color={c.muted}>
              This is the runner status. Individual refunds and payouts still
              need their own reconciliation checks.
            </T>
          </Card>
          <Card>
            <T size={19} bold>
              Needs a person
            </T>
            <View style={{ gap: 12 }}>
              <Button
                secondary
                label={`Overdue support · ${health?.overdueTickets ?? "…"}`}
                onPress={() => go("support")}
              />
              <Button
                secondary
                label={`Financial exceptions · ${health?.financialExceptions ?? "…"}`}
                onPress={() => go("payouts?section=reconciliation")}
              />
            </View>
          </Card>
          <Card>
            <T size={19} bold>
              What the server handles
            </T>
            {[
              [
                "Payment reservations",
                "Releases expired unpaid reservations so time slots can become available again.",
              ],
              [
                "Dispatch deadlines",
                "Flags orders needing assignment and follows the configured dispatch policy.",
              ],
              [
                "Refunds & reconciliation",
                "Processes queued financial jobs and checks provider results. Staff approvals still apply.",
              ],
              [
                "Customer updates",
                "Delivers queued push notifications and Home Care reminders.",
              ],
              ["Routine cleanup", "Removes expired temporary records."],
            ].map(([title, detail]) => (
              <View
                key={title}
                style={{
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: c.line,
                  gap: 5,
                }}
              >
                <T bold>{title}</T>
                <T color={c.muted}>{detail}</T>
              </View>
            ))}
            <T size={12} color={c.muted}>
              Opening this screen does not trigger background jobs or move
              money.
            </T>
          </Card>
          <Card>
            <T size={19} bold>
              Workspace shortcuts
            </T>
            <T color={c.muted}>
              Pages refresh every 30 seconds while active. Order rows calculate
              the next action automatically. Status queues are linked so you can
              return to the same view.
            </T>
            <Button
              label="Review dispatch settings"
              secondary
              onPress={() => go("settings")}
            />
          </Card>
        </>
      )}
    </>
  );
}
