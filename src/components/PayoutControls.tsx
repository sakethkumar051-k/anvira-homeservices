import { useCallback, useEffect, useState } from "react";
import { useApp } from "../lib/context";
import { dateLabel, money } from "../lib/model";
import { T, Card, Button, Input, Row, Badge, c } from "./ui";
import { Choice } from "./Experience";

type Schedule = {
  frequency: "paused" | "daily" | "weekly";
  weekday: number;
  hour: number;
  minimum: number;
  reserve: number;
  maximum: number;
  batchLimit: number;
  approvalRequired: boolean;
  lastRunAt?: number;
};
type Preview = {
  schedule: Schedule;
  nextRunAt: number | null;
  total: number;
  ready: boolean;
  simulated: boolean;
  truncated: boolean;
  rows: {
    id: string;
    name: string;
    available: number;
    amount: number;
    reason: string;
    bankLast4: string;
  }[];
};
const defaults: Schedule = {
  frequency: "paused",
  weekday: 1,
  hour: 18,
  minimum: 100,
  reserve: 0,
  maximum: 10000,
  batchLimit: 100000,
  approvalRequired: true,
};
const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export default function PayoutControls() {
  const { state, read, request, busy } = useApp();
  const [preview, setPreview] = useState<Preview | null>(null),
    [form, setForm] = useState<Schedule>(defaults),
    [message, setMessage] = useState(""),
    [loading, setLoading] = useState(false),
    [reviewed, setReviewed] = useState<string[]>([]),
    [gatewayId, setGatewayId] = useState(""),
    [selected, setSelected] = useState("");
  const load = useCallback(async () => {
    try {
      const value = await read<Preview>("/payout-schedule");
      setPreview(value);
      setForm(value.schedule);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [read]);
  useEffect(() => {
    let current = true;
    void read<Preview>("/payout-schedule")
      .then((value) => {
        if (current) {
          setPreview(value);
          setForm(value.schedule);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (current) {
          setMessage((e as Error).message);
          setLoading(false);
        }
      });
    return () => {
      current = false;
    };
  }, [read]);
  const set = (key: keyof Schedule, value: unknown) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  async function save() {
    try {
      const value = await request<Preview>("/payout-schedule", form, "PUT");
      setPreview(value);
      setForm(value.schedule);
      setMessage(
        form.frequency === "paused"
          ? "Automatic payouts paused. Already approved payouts continue processing."
          : "Payout schedule saved. The next run follows Indian Standard Time.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  async function simulate() {
    try {
      const result = await request<{ queued: number }>(
        "/payout-schedule/demo-run",
        {},
      );
      await load();
      setMessage(
        result.queued
          ? result.queued +
              " sample payout(s) reserved. No real money was sent."
          : "No new payout was due. Check eligibility; this period may already have run.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  const banks =
    state?.professionals.filter(
      (p) =>
        p.bankVerification &&
        ["needs_review", "unknown", "processing"].includes(p.bankVerification),
    ) || [];
  return (
    <>
      <Card style={{ backgroundColor: c.forest }}>
        <T color={c.gold}>OWNER · PAYOUT AUTOMATION</T>
        <T bold size={26} color={c.white}>
          Reliable earnings. On your terms.
        </T>
        <T color={c.white}>
          Set a daily or weekly cycle, keep a reserve and review transfers
          before they leave the business.
        </T>
        <Badge
          label={
            preview?.simulated
              ? "Demo transfers · no real money"
              : preview?.ready
                ? "RazorpayX configured"
                : "RazorpayX setup required"
          }
          tone={preview?.ready ? "green" : "amber"}
        />
      </Card>
      <Card>
        <T bold size={21}>
          Payout schedule
        </T>
        <T size={12} color={c.muted}>
          All schedule times use Indian Standard Time. Only approved partners
          with verified bank accounts qualify. New bank accounts have a cooling
          period before real payouts.
        </T>
        <Row style={{ flexWrap: "wrap" }}>
          {(["paused", "daily", "weekly"] as const).map((value) => (
            <Button
              key={value}
              label={
                value === "paused"
                  ? "Pause automatic payouts"
                  : value === "daily"
                    ? "Daily payouts"
                    : "Weekly payouts"
              }
              secondary={form.frequency !== value}
              onPress={() => set("frequency", value)}
            />
          ))}
        </Row>
        {form.frequency === "weekly" && (
          <Row style={{ flexWrap: "wrap" }}>
            {days.map((day, weekday) => (
              <Button
                key={day}
                label={day}
                secondary={form.weekday !== weekday}
                onPress={() => set("weekday", weekday)}
              />
            ))}
          </Row>
        )}
        {(
          [
            ["hour", "Payout hour (0–23 IST)"],
            ["minimum", "Minimum partner payout (₹)"],
            ["reserve", "Keep in each partner wallet (₹)"],
            ["maximum", "Maximum per partner per cycle (₹)"],
            ["batchLimit", "Maximum total per cycle (₹)"],
          ] as const
        ).map(([key, label]) => (
          <Input
            key={key}
            label={label}
            value={String(form[key])}
            onChangeText={(value) =>
              set(key, value === "" ? NaN : Number(value))
            }
            keyboardType="number-pad"
            editable={!busy}
          />
        ))}
        <Choice
          label="Require Owner approval for scheduled payouts"
          checked={form.approvalRequired}
          onPress={() => set("approvalRequired", !form.approvalRequired)}
        />
        <T size={12} color={c.muted}>
          When approval is required, the cycle reserves earnings and adds
          requests to the queue below. Pausing stops new automatic requests; it
          does not cancel transfers already sent to the provider.
        </T>
        <Button
          label="Save payout schedule"
          loading={busy}
          onPress={() => void save()}
        />
        <Button
          label="Refresh payout preview"
          secondary
          loading={loading}
          onPress={() => void load()}
        />
        {state?.mode === "demo" && (
          <Button
            label="Run sample payout cycle"
            secondary
            disabled={form.frequency === "paused" || busy}
            onPress={() => void simulate()}
          />
        )}
        {!!message && <T accessibilityRole="alert">{message}</T>}
      </Card>
      {preview && (
        <Card style={{ backgroundColor: c.mint }}>
          <T bold size={22}>
            Next cycle preview · {money(preview.total)}
          </T>
          <T>
            {preview.nextRunAt
              ? "Next scheduled run: " + dateLabel(preview.nextRunAt)
              : "Automatic payouts are paused."}
          </T>
          {!!preview.schedule.lastRunAt && (
            <T size={12}>
              Last cycle checked: {dateLabel(preview.schedule.lastRunAt)}
            </T>
          )}
          {preview.rows.map((row) => (
            <Card key={row.id}>
              <Row style={{ justifyContent: "space-between" }}>
                <T bold>{row.name}</T>
                <T bold color={c.green}>
                  {money(row.amount)}
                </T>
              </Row>
              <T size={12}>
                Available {money(row.available)}
                {row.bankLast4 ? " · bank •••• " + row.bankLast4 : ""}
              </T>
              <Badge
                label={row.reason || "Eligible for next cycle"}
                tone={row.reason ? "amber" : "green"}
              />
            </Card>
          ))}
          {!preview.rows.length && (
            <T>
              No partner accounts yet. Approved partner earnings will appear
              here.
            </T>
          )}
          {preview.truncated && (
            <T color={c.red}>
              Preview limit reached. Review all partners before enabling
              automatic payouts at this scale.
            </T>
          )}
        </Card>
      )}
      {!!banks.length && (
        <Card>
          <T bold size={21}>
            Bank verification review
          </T>
          {banks.map((p) => (
            <Card key={p.id} style={{ backgroundColor: c.ivory }}>
              <T bold>
                {p.name} · •••• {p.bankLast4}
              </T>
              <Badge label={p.bankVerification || "Unverified"} tone="amber" />
              <T>Entered holder: {p.bankHolderName}</T>
              <T>
                Bank registered name:{" "}
                {p.bankRegisteredName || "Awaiting provider result"}
              </T>
              {p.bankVerification === "needs_review" ? (
                <>
                  <Choice
                    label={"I checked the bank holder details for " + p.name}
                    checked={reviewed.includes(p.id)}
                    onPress={() =>
                      setReviewed((ids) =>
                        ids.includes(p.id)
                          ? ids.filter((id) => id !== p.id)
                          : [...ids, p.id],
                      )
                    }
                  />
                  <Button
                    label={"Approve bank holder for " + p.name}
                    disabled={!reviewed.includes(p.id) || busy}
                    onPress={() =>
                      void request(
                        "/professionals/" + p.id + "/bank/approve-name",
                        { confirmed: true },
                      ).catch((e) => setMessage(e.message))
                    }
                  />
                </>
              ) : (
                <Button
                  label={"Reconcile bank verification for " + p.name}
                  secondary
                  onPress={() => setSelected(p.id)}
                />
              )}
            </Card>
          ))}
          {!!selected && (
            <>
              <Input
                label="RazorpayX validation ID (fav_)"
                value={gatewayId}
                onChangeText={setGatewayId}
                autoCapitalize="none"
              />
              <Button
                label="Check provider validation"
                loading={busy}
                onPress={() =>
                  void request(
                    "/professionals/" + selected + "/bank/reconcile",
                    { gatewayId },
                  )
                    .then(() => {
                      setSelected("");
                      setGatewayId("");
                    })
                    .catch((e) => setMessage(e.message))
                }
              />
            </>
          )}
        </Card>
      )}
    </>
  );
}
