import React, { useState } from "react";
import { View, Pressable, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { useApp } from "../lib/context";
import {
  money,
  statusLabel,
  serviceDay,
  serviceHour,
  type Booking,
} from "../lib/model";
import { T, c, Card, Row, Icon, Badge } from "./ui";
import { useSummary } from "./Analytics";
import {
  BarChart,
  DeltaPill,
  RankBars,
  StatTile,
  shortMoney,
} from "./Insights";

const go = (href: string) => router.push(href as never);

export function greeting(now: number) {
  const hour = serviceHour(now);
  return hour < 12
    ? "Good morning"
    : hour < 17
      ? "Good afternoon"
      : "Good evening";
}

function ActionTile({
  label,
  count,
  icon,
  href,
  clear,
}: {
  label: string;
  count?: number;
  icon: string;
  href: string;
  clear: string;
}) {
  const { t } = useApp();
  const pending = !!count;
  const accessible =
    count === undefined ? t(label) : t(label) + " · " + (count ?? "…");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessible}
      onPress={() => go(href)}
      style={({ pressed }) => ({
        flexGrow: 1,
        flexBasis: 200,
        minWidth: 160,
        borderRadius: 18,
        padding: 16,
        gap: 10,
        borderWidth: 1,
        borderColor: pending ? "#EBCB97" : c.line,
        backgroundColor: pending ? c.amberbg : c.white,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Row style={{ justifyContent: "space-between" }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pending ? c.white : c.mint,
          }}
        >
          <Icon name={icon} size={18} color={pending ? c.amber : c.green} />
        </View>
        {count !== undefined && (
          <T bold size={26} color={pending ? c.amber : c.ink}>
            {String(count)}
          </T>
        )}
      </Row>
      <View style={{ gap: 2 }}>
        <T bold size={14}>
          {label}
        </T>
        <T size={11} color={pending ? c.amber : c.muted}>
          {pending ? "Needs your attention" : clear}
        </T>
      </View>
    </Pressable>
  );
}

function TodaySchedule({ bookings }: { bookings: Booking[] }) {
  const { state, t } = useApp();
  const [now] = useState(() => Date.now());
  const today = serviceDay(now);
  const visits = bookings
    .filter(
      (b) =>
        serviceDay(b.slot) === today &&
        !["cancelled", "payment_expired", "payment_pending"].includes(
          b.status,
        ),
    )
    .sort((a, b) => a.slot - b.slot);
  return (
    <Card style={{ flex: 1 }}>
      <Row style={{ justifyContent: "space-between" }}>
        <T bold size={19}>
          Today’s visits
        </T>
        <Badge label={visits.length + " " + t("scheduled")} />
      </Row>
      {!visits.length && (
        <T color={c.muted}>
          No visits are scheduled for today. Upcoming paid bookings appear here
          on the day of the visit.
        </T>
      )}
      {visits.slice(0, 8).map((b) => {
        const pro = state?.professionals.find((p) => p.id === b.professionalId);
        const time = new Date(b.slot).toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "numeric",
          minute: "2-digit",
        });
        return (
          <Pressable
            key={b.id}
            accessibilityRole="button"
            accessibilityLabel={t("Open visit") + " " + b.serviceName + " " + time}
            onPress={() => go("/booking/" + b.id)}
            style={({ pressed }) => ({
              flexDirection: "row",
              gap: 14,
              alignItems: "center",
              paddingVertical: 10,
              borderTopWidth: 1,
              borderTopColor: c.line,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View style={{ width: 70 }}>
              <T bold size={13} color={c.green}>
                {time}
              </T>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T bold size={13}>
                {b.serviceName}
              </T>
              <T size={11} color={c.muted} numberOfLines={1}>
                {b.customerName +
                  " · " +
                  b.address.pin +
                  (pro ? " · " + pro.name : " · " + t("No professional yet"))}
              </T>
            </View>
            <Badge
              label={statusLabel(b.status)}
              tone={b.status === "awaiting_assignment" ? "amber" : "green"}
            />
          </Pressable>
        );
      })}
      {visits.length > 8 && (
        <T size={12} color={c.muted}>
          {"+" + (visits.length - 8) + " " + t("more in Orders & dispatch")}
        </T>
      )}
    </Card>
  );
}

export function AdminOverview({ table }: { table: React.ReactNode }) {
  const { summary, error } = useSummary(true);
  const { state, t } = useApp(),
    { width } = useWindowDimensions();
  const [now] = useState(() => Date.now());
  if (!state) return null;
  const owner = state.user.role === "owner";
  const wide = width >= 1100;
  const pulse = summary?.pulse;
  // Default staff names ("ANVIRA Owner") read better as a plain greeting.
  const firstName = /anvira|owner|admin|staff/i.test(state.user.name)
    ? ""
    : state.user.name.trim().split(" ")[0];
  const weekday = (date: string) =>
    new Date(date + "T12:00:00+05:30").toLocaleDateString("en-IN", {
      weekday: "short",
      timeZone: "Asia/Kolkata",
    });
  const attention = summary
    ? summary.awaitingAssignment + summary.refundRequests + summary.openTickets
    : undefined;
  return (
    <>
      <Row
        style={{
          justifyContent: "space-between",
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        <View style={{ gap: 4 }}>
          <T bold size={22} style={{ letterSpacing: -0.5 }}>
            {t(greeting(now)) + (firstName ? ", " + firstName : "")}
          </T>
          <T size={13} color={c.muted}>
            {new Date(now).toLocaleDateString("en-IN", {
              timeZone: "Asia/Kolkata",
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            }) +
              " · " +
              (attention === undefined
                ? t("Loading today’s priorities…")
                : attention
                  ? attention +
                    " " +
                    t(attention === 1 ? "item needs attention" : "items need attention")
                  : t("Everything is under control"))}
          </T>
        </View>
        <Badge
          label={
            state.mode === "demo"
              ? "Demo operations · shared data"
              : "Live operations"
          }
        />
      </Row>
      {!!error && <T color={c.red}>{error}</T>}
      <View style={{ gap: 12 }}>
        <T bold size={19}>
          Your next actions
        </T>
        <Row style={{ flexWrap: "wrap", alignItems: "stretch" }}>
          <ActionTile
            label="Review dispatch"
            count={summary?.awaitingAssignment}
            icon="calendar"
            href="/dashboard/bookings?status=awaiting_assignment"
            clear="Every paid booking has a team"
          />
          <ActionTile
            label="Review refunds"
            count={summary?.refundRequests}
            icon="wallet"
            href="/dashboard/refunds"
            clear="No refund requests waiting"
          />
          <ActionTile
            label="Answer customers"
            count={summary?.openTickets}
            icon="chat"
            href="/dashboard/support"
            clear="Inbox is clear"
          />
          {owner && (
            <ActionTile
              label="Automation health"
              icon="refresh"
              href="/dashboard/automations"
              clear="Background jobs and reminders"
            />
          )}
        </Row>
      </View>
      <Row style={{ flexWrap: "wrap", alignItems: "stretch" }}>
        {owner && pulse ? (
          <>
            <StatTile
              label="Revenue · last 7 days"
              value={money(pulse.current.revenue)}
              icon="wallet"
              tone="forest"
              wide
            >
              <View
                style={{
                  alignSelf: "flex-start",
                  backgroundColor: c.white,
                  borderRadius: 10,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                }}
              >
                <DeltaPill
                  current={pulse.current.revenue}
                  previous={pulse.previous.revenue}
                />
              </View>
            </StatTile>
            <StatTile
              label="Bookings · last 7 days"
              value={String(pulse.current.bookings)}
              icon="calendar"
            >
              <DeltaPill
                current={pulse.current.bookings}
                previous={pulse.previous.bookings}
              />
            </StatTile>
            <StatTile
              label="Average order value"
              value={money(pulse.current.averageOrder)}
              icon="bag"
            >
              <DeltaPill
                current={pulse.current.averageOrder}
                previous={pulse.previous.averageOrder}
              />
            </StatTile>
            <StatTile
              label="Paid conversion"
              value={pulse.current.conversion + "%"}
              icon="chart"
            >
              <T size={11} color={c.muted}>
                {t("Last week") +
                  " " +
                  pulse.previous.conversion +
                  "% · " +
                  pulse.current.cancelled +
                  " " +
                  t("cancelled")}
              </T>
            </StatTile>
            <StatTile
              label="Customer rating"
              value={
                pulse.rating.average === null
                  ? "—"
                  : pulse.rating.average.toFixed(1) + " ★"
              }
              icon="star"
            >
              <T size={11} color={c.muted}>
                {pulse.rating.count
                  ? pulse.rating.count + " " + t("reviews")
                  : t("No reviews yet")}
              </T>
            </StatTile>
          </>
        ) : (
          (
            [
              [
                "Visits scheduled today",
                summary ? String(summary.todayBookings) : "…",
                "calendar",
              ],
              [
                owner ? "Completed service value" : "Completed services",
                summary
                  ? owner
                    ? money(summary.completedValue || 0)
                    : String(summary.completed)
                  : "…",
                "wallet",
              ],
              [
                "Approved professionals",
                summary ? String(summary.approvedProfessionals) : "…",
                "users",
              ],
              [
                "Needs attention",
                attention === undefined ? "…" : String(attention),
                "bell",
              ],
            ] as const
          ).map(([label, value, icon]) => (
            <StatTile key={label} label={label} value={value} icon={icon} />
          ))
        )}
      </Row>
      <View style={{ flexDirection: wide ? "row" : "column", gap: 20 }}>
        <Card style={{ flex: 1 }}>
          <Row style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
            <View style={{ gap: 2 }}>
              <T bold size={19}>
                {owner && pulse ? "Revenue by day" : "Booking activity"}
              </T>
              <T size={12} color={c.muted}>
                {owner && pulse
                  ? "Paid bookings by the day they were made · last 7 days"
                  : "Bookings created per day · last 7 days"}
              </T>
            </View>
            {owner && pulse && (
              <T size={12} bold color={c.green}>
                {pulse.current.paidBookings + " " + t("paid bookings")}
              </T>
            )}
          </Row>
          {summary ? (
            <BarChart
              data={summary.days.map((d) => ({
                label: weekday(d.date),
                value: owner && pulse ? d.revenue || 0 : d.count,
                detail:
                  owner && pulse
                    ? d.count + " " + t(d.count === 1 ? "booking" : "bookings")
                    : undefined,
              }))}
              format={owner && pulse ? shortMoney : String}
            />
          ) : (
            <View style={{ height: 200 }} />
          )}
          {state.mode === "demo" && (
            <T size={11} color={c.muted}>
              Includes sample demonstration records.
            </T>
          )}
        </Card>
        {owner && pulse ? (
          <Card style={{ width: wide ? 380 : undefined }}>
            <T bold size={19}>
              Top services
            </T>
            <T size={12} color={c.muted}>
              Completed visits · last 30 days
            </T>
            {pulse.topServices.length ? (
              <RankBars
                rows={pulse.topServices.map((s) => ({
                  id: s.id,
                  label: s.name,
                  value: s.value,
                  detail: s.completed + " " + t("completed"),
                }))}
                format={money}
              />
            ) : (
              <T color={c.muted}>
                Services rank here once visits are completed.
              </T>
            )}
          </Card>
        ) : (
          <View style={{ width: wide ? 420 : undefined }}>
            <TodaySchedule bookings={state.bookings} />
          </View>
        )}
      </View>
      {owner && pulse && <TodaySchedule bookings={state.bookings} />}
      {table}
    </>
  );
}
