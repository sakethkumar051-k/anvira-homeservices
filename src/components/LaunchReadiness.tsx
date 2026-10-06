import { useEffect, useState } from "react";
import { useApp } from "../lib/context";
import { Card, T, Button, Badge, c, Row } from "./ui";
type Readiness = {
  mode: string;
  checks: { name: string; ready: boolean; detail: string }[];
  openTickets: number;
  overdueTickets: number;
  financialExceptions: number;
};
export default function LaunchReadiness() {
  const { read, state } = useApp();
  const [value, setValue] = useState<Readiness | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [expanded, setExpanded] = useState(false);
  const load = () => {
    setBusy(true);
    void read<Readiness>("/operations/readiness")
      .then((v) => {
        setValue(v);
        setError("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  };
  useEffect(() => {
    let current = true;
    void read<Readiness>("/operations/readiness")
      .then((v) => {
        if (current) setValue(v);
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [read, state]);
  return (
    <Card>
      <T bold size={21}>
        Launch readiness & attention
      </T>
      <T color={c.muted}>
        Checks use current server configuration and business data.
        Payment-provider certification, native device tests, backups and legal
        approval also need verification.
      </T>
      {value && (
        <>
          <Row style={{ flexWrap: "wrap" }}>
            <Badge
              label={
                value.checks.filter((x) => x.ready).length +
                "/" +
                value.checks.length +
                " configured"
              }
            />
            <Badge
              label={value.overdueTickets + " overdue support"}
              tone={value.overdueTickets ? "amber" : undefined}
            />
            <Badge
              label={value.financialExceptions + " financial exceptions"}
            />
          </Row>
          {value.mode === "demo" && (
            <T size={12} color={c.muted}>
              Demo configuration checks are illustrative. They do not certify
              the live Firebase project.
            </T>
          )}
          <Button
            label={
              expanded ? "Hide launch requirements" : "View launch requirements"
            }
            secondary
            onPress={() => setExpanded(!expanded)}
          />
          {expanded &&
            value.checks.map((check) => (
              <Card
                key={check.name}
                style={{ backgroundColor: check.ready ? c.mint : c.ivory }}
              >
                <T bold>{(check.ready ? "✓ " : "○ ") + check.name}</T>
                <T size={12} color={c.muted}>
                  {check.detail}
                </T>
              </Card>
            ))}
        </>
      )}
      {!!error && <T color={c.red}>{error}</T>}
      <Button
        label="Refresh launch checks"
        secondary
        loading={busy}
        onPress={load}
      />
    </Card>
  );
}
