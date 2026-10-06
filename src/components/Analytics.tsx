import React, { useEffect, useState } from "react";
import { useIsFocused } from "expo-router";
import { useApp } from "../lib/context";
import { money } from "../lib/model";
import { T, Card, Row, Input, Button, c } from "./ui";
export type Summary = {
  generatedAt: number;
  bookings: number;
  completed: number;
  completedValue: number | null;
  capturedValue: number | null;
  refundedValue: number | null;
  netCapturedValue: number | null;
  todayBookings: number;
  approvedProfessionals: number;
  awaitingAssignment: number;
  refundRequests: number;
  openTickets: number;
  days: { date: string; count: number }[];
  services: { id: string; name: string; completed: number; value: number }[];
};
export function useSummary() {
  const focused = useIsFocused();
  const { state, read } = useApp();
  const [summary, setSummary] = useState<Summary | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (!focused || !state || !["owner", "care"].includes(state.user.role))
      return;
    let current = true;
    void read<Summary>("/reports/summary")
      .then((result) => {
        if (current) {
          setSummary(result);
          setError("");
        }
      })
      .catch((e) => {
        if (current) setError((e as Error).message);
      });
    return () => {
      current = false;
    };
  }, [state, read, focused]);
  return { summary, error };
}
export function DateRangeSummary() {
  const { read } = useApp(),
    [from, setFrom] = useState(() =>
      new Date(Date.now() - 30 * 86400000 + 330 * 60000)
        .toISOString()
        .slice(0, 10),
    ),
    [to, setTo] = useState(() =>
      new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10),
    ),
    [summary, setSummary] = useState<Summary | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function load() {
    setBusy(true);
    setError("");
    try {
      const start = Date.parse(from + "T00:00:00+05:30"),
        end = Date.parse(to + "T23:59:59.999+05:30");
      if (!Number.isFinite(start) || !Number.isFinite(end))
        throw new Error("Enter valid report dates.");
      setSummary(
        await read<Summary>("/reports/summary?from=" + start + "&to=" + end),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <T bold size={20}>
        Complete date-range analytics
      </T>
      <T color={c.muted}>
        All matching bookings, including records beyond the latest 200. Dates
        use Indian Standard Time.
      </T>
      <Input
        label="Report start (YYYY-MM-DD)"
        value={from}
        onChangeText={setFrom}
      />
      <Input label="Report end (YYYY-MM-DD)" value={to} onChangeText={setTo} />
      <Button
        label="Calculate report"
        loading={busy}
        onPress={() => void load()}
      />
      {!!error && <T color={c.red}>{error}</T>}
      {summary && (
        <>
          {[
            ["Bookings", String(summary.bookings)],
            ["Completed service value", money(summary.completedValue || 0)],
            ["Captured booking value", money(summary.capturedValue || 0)],
            ["Confirmed full refunds", money(summary.refundedValue || 0)],
            [
              "Net captured booking value",
              money(summary.netCapturedValue || 0),
            ],
          ].map(([label, value]) => (
            <Row
              key={label}
              style={{ justifyContent: "space-between", flexWrap: "wrap" }}
            >
              <T>{label}</T>
              <T bold>{value}</T>
            </Row>
          ))}
          <T size={11} color={c.muted}>
            Booking cohorts use the creation date. Values reflect current
            payment status; they are not bank settlement totals or accounting
            profit.
          </T>
          <T bold size={18}>
            Service performance
          </T>
          {summary.services.map((s) => (
            <Row
              key={s.id}
              style={{ justifyContent: "space-between", flexWrap: "wrap" }}
            >
              <T>{s.name}</T>
              <T bold>
                {s.completed} completed · {money(s.value)}
              </T>
            </Row>
          ))}
        </>
      )}
    </Card>
  );
}
