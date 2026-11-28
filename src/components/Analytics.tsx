import React, { useEffect, useRef, useState } from "react";
import { useIsFocused } from "expo-router";
import { useApp } from "../lib/context";
import { money } from "../lib/model";
import { T, Card, Row, Input, Button, c } from "./ui";
import { RankBars, StatTile } from "./Insights";
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
  days: { date: string; count: number; revenue?: number }[];
  services: { id: string; name: string; completed: number; value: number }[];
  pulse?: {
    current: PulsePeriod;
    previous: PulsePeriod;
    rating: { count: number; average: number | null };
    topServices: {
      id: string;
      name: string;
      completed: number;
      value: number;
    }[];
  };
};
export type PulsePeriod = {
  bookings: number;
  paidBookings: number;
  revenue: number;
  averageOrder: number;
  conversion: number;
  cancelled: number;
  completed: number;
};
export function useSummary(insights = false) {
  const focused = useIsFocused();
  const { state, read } = useApp();
  const [summary, setSummary] = useState<Summary | null>(null),
    [error, setError] = useState("");
  const role = state?.user.role,
    revision = state?.revision;
  useEffect(() => {
    if (!focused || !role || !["owner", "care"].includes(role)) return;
    let current = true;
    void read<Summary>(
      "/reports/summary" + (insights && role === "owner" ? "?insights=1" : ""),
    )
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
    // Reload when the server reports a change, not on every render.
  }, [role, revision, read, focused, insights]);
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
  const latest = useRef(0);
  async function load(startDate = from, endDate = to) {
    // Only the newest request may update the screen.
    const ticket = ++latest.current;
    setBusy(true);
    setError("");
    try {
      const start = Date.parse(startDate + "T00:00:00+05:30"),
        end = Date.parse(endDate + "T23:59:59.999+05:30");
      if (!Number.isFinite(start) || !Number.isFinite(end))
        throw new Error("Enter valid report dates.");
      const result = await read<Summary>(
        "/reports/summary?from=" + start + "&to=" + end,
      );
      if (ticket === latest.current) setSummary(result);
    } catch (e) {
      if (ticket === latest.current) setError((e as Error).message);
    } finally {
      if (ticket === latest.current) setBusy(false);
    }
  }
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void load();
  });
  return (
    <Card>
      <T bold size={20}>
        Complete date-range analytics
      </T>
      <T color={c.muted}>
        All matching bookings, including records beyond the latest 200. Dates
        use Indian Standard Time.
      </T>
      <Row style={{ flexWrap: "wrap" }}>
        {[
          [1, "Today"],
          [7, "Last 7 days"],
          [30, "Last 30 days"],
        ].map(([days, label]) => (
          <Button
            key={String(days)}
            label={String(label)}
            secondary
            disabled={busy}
            onPress={() => {
              const now = Date.now() + 330 * 60000;
              const start = new Date(now - (Number(days) - 1) * 86400000)
                  .toISOString()
                  .slice(0, 10),
                end = new Date(now).toISOString().slice(0, 10);
              setFrom(start);
              setTo(end);
              void load(start, end);
            }}
          />
        ))}
      </Row>
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
          <Row style={{ flexWrap: "wrap", alignItems: "stretch" }}>
            <StatTile
              label="Net captured booking value"
              value={money(summary.netCapturedValue || 0)}
              icon="wallet"
              tone="forest"
              wide
            />
            <StatTile
              label="Bookings"
              value={String(summary.bookings)}
              icon="calendar"
            />
            <StatTile
              label="Completed service value"
              value={money(summary.completedValue || 0)}
              icon="check"
            />
            <StatTile
              label="Captured booking value"
              value={money(summary.capturedValue || 0)}
              icon="bag"
            />
            <StatTile
              label="Confirmed full refunds"
              value={money(summary.refundedValue || 0)}
              icon="refresh"
            />
          </Row>
          <T size={11} color={c.muted}>
            Booking cohorts use the creation date. Values reflect current
            payment status; they are not bank settlement totals or accounting
            profit.
          </T>
          <T bold size={18}>
            Service performance
          </T>
          {summary.services.some((s) => s.completed) ? (
            <RankBars
              rows={summary.services
                .filter((s) => s.completed)
                .sort((a, b) => b.value - a.value)
                .map((s) => ({
                  id: s.id,
                  label: s.name,
                  value: s.value,
                  detail: s.completed + " completed",
                }))}
              format={money}
            />
          ) : (
            <T color={c.muted}>No completed visits in this date range.</T>
          )}
        </>
      )}
    </Card>
  );
}
