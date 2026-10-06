import LaunchReadiness from "./LaunchReadiness";
import { ProfessionalPhoto } from "./ProfessionalPhoto";
import React, { useState } from "react";
import { View, Pressable, useWindowDimensions, ScrollView } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import Svg, { Path, Line } from "react-native-svg";
import { useApp } from "../lib/context";
import {
  Service,
  Booking,
  Professional,
  Ticket,
  AppState,
  money,
  dateLabel,
  statusLabel,
} from "../lib/model";
import {
  T,
  c,
  Card,
  Row,
  Icon,
  Button,
  Input,
  Badge,
  Empty,
  Divider,
  styles,
} from "./ui";
import { Shell } from "./Shell";
import { PartnerWallet } from "./Experience";
import {
  ServiceEditor,
  VendorReview,
  SupportReply,
  CompanySettings,
  Promotions,
  FinancialOperations,
  ExportReport,
} from "./Workbench";
import { BookingCard } from "./Customer";
import { useSummary, DateRangeSummary } from "./Analytics";
import { usePagedRecords, PageControls } from "./PagedRecords";
const go = (href: string) => router.push(href as never);
export function Jobs() {
  const { state, request, busy } = useApp(),
    [tab, setTab] = useState("active");
  const active =
      state?.bookings
        .filter(
          (b) =>
            !["completed", "cancelled", "payment_expired"].includes(b.status),
        )
        .sort((a, b) => a.slot - b.slot) || [],
    completed = state?.bookings.filter((b) => b.status === "completed") || [];
  return (
    <Shell title="Your workspace">
      <T bold size={25}>
        Welcome, {state?.user.name.split(" ")[0]}.
      </T>
      {!state?.professionals.find((p) => p.id === state.user.id)?.approved && (
        <Card style={{ backgroundColor: c.amberbg }}>
          <T bold>Complete your professional profile</T>
          <T>
            Submit your skills and verification documents before accepting jobs.
          </T>
          <Button
            label="Professional profile & schedule"
            secondary
            onPress={() => go("/partner")}
          />
        </Card>
      )}
      <Button
        label={
          state?.professionals.find((p) => p.id === state.user.id)
            ?.available === false
            ? "Go available"
            : "Pause new assignments"
        }
        secondary
        disabled={busy}
        onPress={() =>
          void request(
            "/availability",
            {
              available:
                state?.professionals.find((p) => p.id === state.user.id)
                  ?.available === false,
            },
            "PATCH",
          ).catch(() => {})
        }
      />
      <Card style={{ backgroundColor: c.mint }}>
        <Badge label="ANVIRA professional" />
        <T bold size={21}>
          Care starts with you.
        </T>
        <T color={c.muted}>
          Your jobs, customer details and service checklist in one place.
        </T>
      </Card>
      <Row>
        <Card style={{ flex: 1 }}>
          <Icon name="calendar" />
          <T size={27} bold color={c.green}>
            {active.length}
          </T>
          <T size={12} color={c.muted}>
            Active jobs
          </T>
        </Card>
        <Card style={{ flex: 1 }}>
          <Icon name="check" />
          <T size={27} bold color={c.green}>
            {completed.length}
          </T>
          <T size={12} color={c.muted}>
            Completed
          </T>
        </Card>
      </Row>
      <Row>
        {["active", "history"].map((x) => (
          <Pressable
            key={x}
            onPress={() => setTab(x)}
            style={{
              padding: 14,
              borderRadius: 16,
              backgroundColor: tab === x ? c.mint : c.white,
              flex: 1,
            }}
          >
            <T bold>
              {x === "active" ? "Job requests & schedule" : "Job history"}
            </T>
          </Pressable>
        ))}
      </Row>
      {tab === "history" && <ProfessionalHistory />}
      {(tab === "active" ? active : []).map((b) => (
        <BookingCard b={b} key={b.id} />
      ))}
      {tab === "active" && !active.length && (
        <Empty
          title="Your schedule is clear"
          detail={
            state?.mode === "demo"
              ? "Assigned jobs will appear here. Create a customer booking in the demo to explore the workflow."
              : "Assigned jobs will appear here. Keep your availability and service areas up to date."
          }
        />
      )}
    </Shell>
  );
}
function ProfessionalHistory() {
  const history = usePagedRecords<Booking>("bookings");
  const [search, setSearch] = useState("");
  const rows = history.rows.filter(
    (b) =>
      ["completed", "cancelled", "payment_expired"].includes(b.status) &&
      (b.serviceName + " " + b.customerName + " " + b.id)
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <Input
        label="Search this history page"
        value={search}
        onChangeText={setSearch}
        placeholder="Customer, service or booking ID"
      />
      <PageControls list={history} label="job history" />
      {rows.map((b) => (
        <BookingCard key={b.id} b={b} />
      ))}
      {!history.busy && !history.error && !rows.length && (
        <T color={c.muted}>
          No completed or cancelled jobs on this page. Use the page controls to
          see earlier records.
        </T>
      )}
    </>
  );
}
export function Earnings() {
  return (
    <Shell title="Earnings">
      <PartnerWallet />
    </Shell>
  );
}
const titles: Record<string, string> = {
  home: "Overview",
  bookings: "Bookings",
  vendors: "Professionals",
  services: "Services",
  refunds: "Payments & refunds",
  support: "Customer support",
  reports: "Reports",
  settings: "Roles & settings",
  payouts: "Payouts & reconciliation",
  offers: "Offers",
};
export function Dashboard() {
  const { tab = "home" } = useLocalSearchParams<{ tab: string }>(),
    { state } = useApp();
  if (!state) return null;
  const allowed =
    state.user.role === "owner" ||
    (state.user.role === "care" &&
      ["home", "bookings", "refunds", "support"].includes(tab));
  if (!allowed)
    return (
      <Shell title="Access restricted">
        <Empty
          title="Owner access required"
          detail="This workspace is restricted to the Owner role."
        />
      </Shell>
    );
  return (
    <Shell title={titles[tab] || "Overview"}>
      {tab === "home" ? (
        <Overview />
      ) : tab === "bookings" ? (
        <BookingTable />
      ) : tab === "vendors" ? (
        <Vendors />
      ) : tab === "services" ? (
        <ServiceManager />
      ) : tab === "refunds" ? (
        <Refunds />
      ) : tab === "support" ? (
        <Requests />
      ) : tab === "reports" ? (
        <Reports />
      ) : tab === "payouts" ? (
        <FinancialOperations />
      ) : tab === "offers" ? (
        <Promotions />
      ) : tab === "settings" ? (
        <Settings />
      ) : (
        <Empty
          title="Page not found"
          detail="Choose a page in the navigation."
        />
      )}
    </Shell>
  );
}
function Overview() {
  const { summary, error } = useSummary();
  const { state } = useApp(),
    { width } = useWindowDimensions();
  if (!state) return null;
  const metrics = [
    [
      "Today’s bookings",
      summary ? String(summary.todayBookings) : "…",
      "calendar",
    ],
    [
      state.user.role === "owner"
        ? "Completed service value"
        : "Completed services",
      summary
        ? state.user.role === "owner"
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
      summary
        ? String(
            summary.awaitingAssignment +
              summary.refundRequests +
              summary.openTickets,
          )
        : "…",
      "bell",
    ],
  ];
  return (
    <>
      {state.user.role === "owner" && <LaunchReadiness />}
      <Row style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <View>
          <T color={c.muted}>Good care, from the inside.</T>
          <T size={12} color={c.muted}>
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
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
      {error && <T color={c.red}>{error}</T>}
      {summary && (
        <T color={c.muted}>
          Overview totals include the full booking history. Recent booking cards
          show the latest records.
        </T>
      )}
      <View style={styles.grid}>
        {metrics.map(([label, value, icon]) => (
          <Card
            key={label}
            style={{
              flexGrow: 1,
              width: width >= 1100 ? "22%" : "45%",
              minWidth: 150,
            }}
          >
            <Row style={{ justifyContent: "space-between" }}>
              <T size={12} color={c.muted} style={{ flex: 1 }}>
                {label}
              </T>
              <Icon name={icon} />
            </Row>
            <T size={30} bold>
              {value}
            </T>
            <T size={10} color={c.green}>
              {state.mode === "demo"
                ? "From current demo records"
                : "Server-calculated totals"}
            </T>
          </Card>
        ))}
      </View>
      <View
        style={{ flexDirection: width >= 1100 ? "row" : "column", gap: 24 }}
      >
        <Card style={{ flex: 1 }}>
          <Row style={{ justifyContent: "space-between" }}>
            <T bold size={19}>
              Booking activity
            </T>
            <T size={12} color={c.muted}>
              Last 7 days
            </T>
          </Row>
          <ActivityChart />
          <T size={11} color={c.muted}>
            Bookings created per day. No bookings are pre-populated.
          </T>
        </Card>
        <Card
          style={{
            backgroundColor: c.mint,
            width: width >= 1100 ? 340 : undefined,
          }}
        >
          <T bold size={19}>
            Today needs your care
          </T>
          <T color={c.muted}>
            {summary?.awaitingAssignment ?? "…"} bookings awaiting assignment
          </T>
          <T color={c.muted}>
            {summary?.refundRequests ?? "…"} refund requests
          </T>
          <T color={c.muted}>
            {summary?.openTickets ?? "…"} open support requests
          </T>
          <Button
            label="Open bookings"
            onPress={() => go("/dashboard/bookings")}
          />
          <Button
            label="Review support"
            secondary
            onPress={() => go("/dashboard/support")}
          />
        </Card>
      </View>
      <BookingTable compact />
    </>
  );
}
function ActivityChart() {
  const { summary } = useSummary();
  const days =
    summary?.days.map((d) => new Date(d.date + "T12:00:00+05:30")) || [];
  const counts = summary?.days.map((d) => d.count) || [],
    max = Math.max(1, ...counts);
  const points = counts.map(
      (n, i) => `${20 + i * 75},${150 - (n / max) * 120}`,
    ),
    path = "M" + points.join(" L");
  return (
    <View style={{ gap: 8 }}>
      <Svg width="100%" height={180} viewBox="0 0 500 180">
        {[30, 70, 110, 150].map((y) => (
          <Line key={y} x1="20" y1={y} x2="480" y2={y} stroke={c.line} />
        ))}
        <Path d={path + " L470,150 L20,150 Z"} fill={c.mint} />
        <Path d={path} fill="none" stroke={c.green} strokeWidth={3} />
      </Svg>
      <Row style={{ justifyContent: "space-between" }}>
        {days.map((d, i) => (
          <T key={i} size={10} color={c.muted}>
            {d.toLocaleDateString("en-IN", { weekday: "short" })}
          </T>
        ))}
      </Row>
    </View>
  );
}
function BookingTable({ compact = false }: { compact?: boolean }) {
  const { state, read } = useApp(),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [older, setOlder] = useState<Booking[]>([]),
    [more, setMore] = useState(true),
    [loading, setLoading] = useState(false);
  async function load() {
    const last = older.at(-1) || state?.bookings.at(-1);
    if (!last) return;
    setLoading(true);
    try {
      const page = await read<{ rows: Booking[]; nextCursor: unknown }>(
        "/bookings?cursor=" +
          encodeURIComponent(JSON.stringify([last.createdAt, last.id])),
      );
      setOlder((rows) => [...rows, ...page.rows]);
      setMore(!!page.nextCursor);
    } finally {
      setLoading(false);
    }
  }
  let bookings = [
    ...new Map(
      [...(state?.bookings || []), ...older].map((b) => [b.id, b]),
    ).values(),
  ]
    .filter(
      (b) =>
        (b.customerName + " " + b.serviceName + " " + b.id)
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (filter === "all" || b.status === filter),
    )
    .sort((a, b) => b.createdAt - a.createdAt);
  if (compact) bookings = bookings.slice(0, 5);
  return (
    <Card>
      <Row style={{ justifyContent: "space-between" }}>
        <T bold size={19}>
          {compact ? "Recent bookings" : "All bookings"}
        </T>
        <Badge label={`${bookings.length} records`} />
      </Row>
      {!compact && (
        <>
          <Input
            label="Search bookings"
            value={search}
            onChangeText={setSearch}
            placeholder="Customer, service or booking ID"
          />
          <ScrollView horizontal>
            <Row>
              {[
                "all",
                "assigned",
                "confirmed",
                "in_progress",
                "completed",
                "cancelled",
                "awaiting_assignment",
              ].map((f) => (
                <Pressable
                  key={f}
                  onPress={() => setFilter(f)}
                  style={{
                    padding: 10,
                    borderRadius: 12,
                    backgroundColor: f === filter ? c.mint : c.ivory,
                  }}
                >
                  <T size={12}>{f === "all" ? "All" : statusLabel(f)}</T>
                </Pressable>
              ))}
            </Row>
          </ScrollView>
        </>
      )}
      <ScrollView horizontal>
        <View style={{ minWidth: 850, flex: 1 }}>
          <Row
            style={{ backgroundColor: c.soft, padding: 14, borderRadius: 12 }}
          >
            {[
              "Booking & customer",
              "Service",
              "Scheduled for",
              "Status",
              "Value",
            ].map((x, i) => (
              <T
                key={x}
                size={11}
                bold
                color={c.muted}
                style={{ width: [180, 210, 190, 150, 90][i] }}
              >
                {x}
              </T>
            ))}
          </Row>
          {bookings.map((b) => (
            <Pressable
              accessibilityLabel={"Open booking " + b.id.slice(0, 8)}
              key={b.id}
              onPress={() => go("/booking/" + b.id)}
              style={{
                borderBottomWidth: 1,
                borderBottomColor: c.line,
                padding: 14,
              }}
            >
              <Row>
                <View style={{ width: 180 }}>
                  <T bold size={12}>
                    {b.customerName}
                  </T>
                  <T size={10} color={c.muted}>
                    #{b.id.slice(0, 8).toUpperCase()}
                  </T>
                </View>
                <T size={12} style={{ width: 210 }}>
                  {b.serviceName}
                </T>
                <T size={12} color={c.muted} style={{ width: 190 }}>
                  {dateLabel(b.slot)}
                </T>
                <View style={{ width: 150 }}>
                  <Badge
                    label={statusLabel(b.status)}
                    tone={b.status === "cancelled" ? "red" : "green"}
                  />
                </View>
                <T size={12} bold style={{ width: 90 }}>
                  {money(b.total)}
                </T>
              </Row>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      {!compact && state?.hasMoreBookings && more && (
        <Button
          label="Load earlier bookings"
          secondary
          loading={loading}
          onPress={() => void load().catch(() => {})}
        />
      )}
      {!bookings.length && <T color={c.muted}>No bookings match this view.</T>}
    </Card>
  );
}
function Vendors() {
  const { state } = useApp();
  const list = usePagedRecords<Professional>("professionals"),
    [search, setSearch] = useState("");
  return (
    <>
      <T color={c.muted}>
        Approve professionals only after identity, skill and coverage checks.
        {state?.mode === "demo"
          ? "All profiles below are sample records."
          : "Review documents before approving a professional."}
      </T>
      <Input
        label="Search professionals on this page"
        value={search}
        onChangeText={setSearch}
      />
      <PageControls list={list} label="professionals" />
      <View style={styles.grid}>
        {list.rows
          .filter((p) =>
            (p.name + " " + p.skills.join(" "))
              .toLowerCase()
              .includes(search.toLowerCase()),
          )
          .map((p) => (
            <Card
              key={p.id}
              style={{ flexGrow: 1, minWidth: 250, maxWidth: 420 }}
            >
              <Row>
                <ProfessionalPhoto professional={p} />
                <View style={{ flex: 1 }}>
                  <T bold size={19}>
                    {p.name}
                  </T>
                  <T color={c.muted} size={12}>
                    {p.type} · ★ {p.rating} · {p.jobs}{" "}
                    {state?.mode === "demo" ? "sample jobs" : "completed jobs"}
                  </T>
                </View>
              </Row>
              <Badge
                label={p.approved ? "Approved" : "Review pending"}
                tone={p.approved ? "green" : "amber"}
              />
              <T size={12} color={c.muted}>
                {p.skills.join(" · ")}
              </T>
              <VendorReview professional={p} />
            </Card>
          ))}
      </View>
    </>
  );
}
function ServiceManager() {
  const { state } = useApp();
  return (
    <>
      <T color={c.muted}>
        {state?.mode === "demo"
          ? "Sample pricing in whole rupees."
          : "Pricing in whole rupees."}{" "}
        Changes apply to new bookings; existing bookings retain their original
        price.
      </T>
      <ServiceEditor />
      <View style={styles.grid}>
        {state?.services.map((s) => (
          <PriceEditor key={s.id} s={s} />
        ))}
      </View>
    </>
  );
}
function PriceEditor({ s }: { s: Service }) {
  const { request, busy, state } = useApp(),
    [price, setPrice] = useState(String(s.price)),
    [saved, setSaved] = useState(false),
    [feedback, setFeedback] = useState("");
  const [previousPrice, setPreviousPrice] = useState(s.price);
  if (previousPrice !== s.price) {
    setPreviousPrice(s.price);
    setPrice(String(s.price));
  }
  async function save() {
    try {
      await request("/services/" + s.id, { price: Number(price) }, "PATCH");
      setSaved(true);
    } catch {}
  }
  return (
    <Card style={{ flexGrow: 1, minWidth: 280, maxWidth: 480 }}>
      <Row>
        <Icon name={s.icon} />
        <T bold size={18} style={{ flex: 1 }}>
          {s.name}
        </T>
      </Row>
      <T color={c.muted}>{s.duration} minutes</T>
      <Input
        label="Base price (₹)"
        keyboardType="number-pad"
        value={price}
        onChangeText={(v) => {
          setPrice(v);
          setSaved(false);
        }}
      />
      <Button label="Save price" loading={busy} onPress={() => void save()} />
      {saved && <Badge label="Price saved" />}
      {s.sample && state?.mode === "firebase" && (
        <Badge label="Sample draft · review scope and prices" tone="amber" />
      )}
      <Badge label={s.active ? "Published" : "Draft / hidden"} />
      <T size={12} color={c.muted}>
        {(s.packages?.length || 0) +
          " packages · " +
          (s.optionGroups?.length || 0) +
          " choice groups"}
      </T>
      <Button
        label="Duplicate as draft"
        secondary
        loading={busy}
        onPress={() =>
          void request("/services", {
            ...s,
            name: (s.name + " copy").slice(0, 100),
            active: false,
          })
            .then(() =>
              setFeedback(
                "Draft copy created. Edit its details before publishing.",
              ),
            )
            .catch((e) => setFeedback(e.message))
        }
      />
      <Button
        label={s.active ? "Hide from customers" : "Publish service"}
        secondary
        disabled={state?.mode === "firebase" && !!s.sample && !s.active}
        loading={busy}
        onPress={() =>
          void request(
            "/services/" + s.id,
            { ...s, active: !s.active },
            "PATCH",
          )
            .then(() =>
              setFeedback(
                s.active
                  ? "Service hidden. Existing bookings keep their original scope."
                  : "Service published.",
              ),
            )
            .catch((e) => setFeedback(e.message))
        }
      />
      {!!feedback && <T accessibilityRole="alert">{feedback}</T>}
      <ServiceEditor service={s} />
    </Card>
  );
}
function Refunds() {
  const { state, request, busy } = useApp();
  const bookings = state?.bookings.filter((b) => b.refund) || [];
  return (
    <>
      <Card style={{ backgroundColor: c.mint }}>
        <T bold size={20}>
          Clear payment states. Careful approvals.
        </T>
        <T color={c.muted}>
          {state?.mode === "demo"
            ? "All payments and refunds in this preview are simulated."
            : "Provider-confirmed payments and refunds are recorded here."}{" "}
          Customer Care can review requests; only the Owner can approve a
          refund.
        </T>
      </Card>
      {bookings.map((b) => (
        <Card key={b.id}>
          <Row style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
            <View>
              <T bold size={18}>
                {b.customerName} · {b.serviceName}
              </T>
              <T color={c.muted} size={12}>
                #{b.id.slice(0, 8)} · Full refund {money(b.total)}
              </T>
            </View>
            <Badge label={statusLabel(b.refund!)} tone="amber" />
          </Row>
          {state?.user.role === "owner" && b.refund === "requested" && (
            <Button
              label="Approve full refund"
              loading={busy}
              onPress={() =>
                void request("/bookings/" + b.id + "/action", {
                  action: "refund",
                }).catch(() => {})
              }
            />
          )}
          <Button
            label="Open booking"
            secondary
            onPress={() => go("/booking/" + b.id)}
          />
        </Card>
      ))}
      {!bookings.length && (
        <Empty
          title="No refund requests"
          detail="Cancelled paid bookings create a refund request here."
        />
      )}
    </>
  );
}
function Requests() {
  const [queue, setQueue] = useState("all");
  const list = usePagedRecords<Ticket>(
    "tickets",
    queue === "all"
      ? ""
      : queue === "quality"
        ? "status=open&priority=high"
        : "status=open",
  );
  return (
    <>
      <Row style={{ flexWrap: "wrap" }}>
        {[
          ["all", "All requests"],
          ["open", "Open requests"],
          ["quality", "Quality follow-ups"],
        ].map(([value, label]) => (
          <Button
            key={value}
            label={label}
            secondary={queue !== value}
            onPress={() => setQueue(value)}
          />
        ))}
      </Row>
      <PageControls list={list} label="support" />
      {list.rows.length ? (
        list.rows.slice().map((t) => (
          <Card key={t.id}>
            <Row style={{ justifyContent: "space-between" }}>
              <T bold size={18}>
                {t.customerName}
              </T>
              <Badge label={t.status} />
            </Row>
            {t.priority === "high" && t.status === "open" && (
              <Badge label="Service quality · needs attention" tone="red" />
            )}
            {t.escalatedAt && t.status === "open" && (
              <Badge label="Response overdue · escalated" tone="amber" />
            )}
            {t.responseDueAt && t.status === "open" && (
              <T size={12} color={c.muted}>
                {"Response target: " + dateLabel(t.responseDueAt)}
              </T>
            )}
            {t.category && (
              <T size={12} color={c.muted}>
                {"Topic: " + t.category}
              </T>
            )}
            {t.bookingId && (
              <Button
                label={"View booking #" + t.bookingId.slice(0, 8).toUpperCase()}
                secondary
                onPress={() => go("/booking/" + t.bookingId)}
              />
            )}
            <T>{t.message}</T>
            <SupportReply ticket={t} />
            <T color={c.muted} size={11}>
              {dateLabel(t.createdAt)} · #{t.id.slice(0, 8)}
            </T>
          </Card>
        ))
      ) : (
        <Empty
          title="No open conversations"
          detail="Requests submitted in the customer app appear here."
        />
      )}
    </>
  );
}
function Reports() {
  const { state } = useApp();
  const audit = usePagedRecords<AppState["audit"][number]>("audit");
  if (!state) return null;
  return (
    <>
      <ExportReport />
      <DateRangeSummary />
      <Card>
        <T bold size={20}>
          Service performance
        </T>
        <ActivityChart />
      </Card>
      <Card>
        <T bold size={20}>
          Audit trail
        </T>
        <PageControls list={audit} label="audit" />
        {audit.rows.map((a) => (
          <View key={a.id}>
            <Row style={{ justifyContent: "space-between" }}>
              <T bold size={12}>
                {a.action.replaceAll("_", " ")}
              </T>
              <T color={c.muted} size={11}>
                {dateLabel(new Date(a.at).getTime())}
              </T>
            </Row>
            <T color={c.muted} size={11}>
              {a.actor} · {a.target.slice(0, 8)}
            </T>
            <Divider />
          </View>
        ))}
        {!audit.rows.length && (
          <T color={c.muted}>Actions will be recorded here.</T>
        )}
      </Card>
    </>
  );
}
function Settings() {
  return <CompanySettings />;
}
