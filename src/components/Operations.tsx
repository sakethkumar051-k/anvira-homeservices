import { ConfirmAction } from "./ConfirmAction";
import Automations from "./Automations";
import { orderNextAction } from "../lib/admin-workflow";
import { BannerManager } from "./BannerManager";
import { CatalogLibrary } from "./CatalogLibrary";
import { servicePricing } from "../lib/service-catalog";
import OwnerSetupGuide from "./OwnerSetupGuide";
import { ServiceQuotes } from "./ServiceQuotes";
import { PartnerOffers } from "./PartnerOffers";
import LaunchReadiness from "./LaunchReadiness";
import { ProfessionalPhoto } from "./ProfessionalPhoto";
import React, { useState } from "react";
import {
  View,
  Pressable,
  useWindowDimensions,
  ScrollView,
  Platform,
  Linking,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
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
  SupportDraft,
  CompanySettings,
  Promotions,
  FinancialOperations,
  ExportReport,
} from "./Workbench";
import { BookingCard } from "./Customer";
import InhouseWorkers from "./InhouseWorkers";
import WebsiteConfiguration from "./WebsiteConfiguration";
import StaffOrderCards from "./StaffOrderCards";
import { DateRangeSummary } from "./Analytics";
import { AdminOverview } from "./AdminOverview";
import { Growth } from "./Growth";
import { usePagedRecords, PageControls } from "./PagedRecords";
const go = (href: string) => router.push(href as never);
function NextJobCard({ booking: b }: { booking: Booking }) {
  const { lang, t, state } = useApp();
  const [now] = useState(() => Date.now());
  const minutes = Math.round((b.slot - now) / 60000);
  const te = lang === "te";
  const hours = Math.round(minutes / 60);
  const when =
    b.status === "in_progress"
      ? t("In progress")
      : minutes < -60
        ? t("Overdue")
        : minutes <= 0
          ? t("Now")
          : minutes < 60
            ? te
              ? minutes + " నిమిషాల్లో"
              : "In " + minutes + " min"
            : minutes < 24 * 60
              ? te
                ? hours + " గంటల్లో"
                : "In " + hours + (hours === 1 ? " hour" : " hours")
              : dateLabel(b.slot, lang);
  const weekStart = now - 7 * 86400000;
  const week = (state?.ledger || [])
    .filter((x) => x.createdAt >= weekStart)
    .reduce((sum, x) => sum + x.amount, 0);
  return (
    <View
      style={{
        backgroundColor: c.forest,
        borderRadius: 22,
        padding: 18,
        gap: 12,
      }}
    >
      <Row style={{ justifyContent: "space-between" }}>
        <T size={11} bold color={c.gold} style={{ letterSpacing: 1 }}>
          NEXT JOB
        </T>
        <View
          style={{
            backgroundColor: "#205045",
            borderRadius: 12,
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}
        >
          <T size={11} bold color={c.white}>
            {when}
          </T>
        </View>
      </Row>
      <View style={{ gap: 2 }}>
        <T bold size={19} color={c.white}>
          {b.serviceName}
        </T>
        <T size={12} color="#B7CEC4">
          {dateLabel(b.slot, lang) + " · " + statusLabel(b.status)}
        </T>
        <T size={12} color="#B7CEC4">
          {t("PIN code") + " " + b.address.pin}
        </T>
      </View>
      <Row>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Open job") + " " + b.serviceName}
          onPress={() => go("/booking/" + b.id)}
          style={{
            flex: 1,
            minHeight: 46,
            borderRadius: 14,
            backgroundColor: c.gold,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <T bold color={c.forest}>
            Open job
          </T>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Directions")}
          onPress={() =>
            void Linking.openURL(
              "https://www.google.com/maps/search/?api=1&query=" +
                encodeURIComponent(
                  b.address.line + ", " + b.address.pin + ", India",
                ),
            ).catch(() => {})
          }
          style={{
            flex: 1,
            minHeight: 46,
            borderRadius: 14,
            backgroundColor: "#205045",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <T bold color={c.white}>
            Directions
          </T>
        </Pressable>
      </Row>
      {week > 0 && (
        <T size={12} color="#B7CEC4">
          {t("Earned in the last 7 days") + ": " + money(week)}
        </T>
      )}
    </View>
  );
}
export function Jobs() {
  const { tab: requestedTab } = useLocalSearchParams<{ tab?: string }>();
  const { state, request, busy } = useApp(),
    [tab, setTab] = useState(requestedTab === "history" ? "history" : "active"),
    [availabilityError, setAvailabilityError] = useState("");
  const profile = state?.professionals.find((p) => p.id === state.user.id);
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
      <View style={{ gap: 5 }}>
        <T bold size={25}>
          Welcome, {state?.user.name.split(" ")[0]}.
        </T>
        <T size={13} color={c.muted}>
          See your upcoming jobs and manage your availability.
        </T>
      </View>
      {active[0] && <NextJobCard booking={active[0]} />}
      {!state?.professionals.find((p) => p.id === state.user.id)?.approved && (
        <Card style={{ backgroundColor: c.amberbg }}>
          <T bold>Complete your professional profile</T>
          <T>
            Submit your skills and verification documents before accepting jobs.
          </T>
          <Button
            label="Professional profile"
            secondary
            onPress={() => go("/partner")}
          />
        </Card>
      )}
      <Card
        style={{
          backgroundColor:
            profile?.approved && profile.available ? c.mint : c.soft,
        }}
      >
        <Badge
          label={
            profile?.approved && profile.available ? "Available" : "Offline"
          }
          tone={profile?.approved && profile.available ? "green" : "amber"}
        />
        <T bold size={22}>
          {profile?.approved && profile.available
            ? "You’re available for new jobs"
            : "You’re offline"}
        </T>
        <T size={13} color={c.muted}>
          {profile?.approved && profile.available
            ? "Stay available to receive matching job offers."
            : "Go available when you’re ready to receive job offers."}
        </T>
        <Button
          label={
            profile?.approved && profile.available
              ? "Go offline"
              : "Go available"
          }
          loading={busy}
          disabled={!profile?.approved}
          disabledReason="Your profile must be approved before accepting work."
          onPress={() => {
            setAvailabilityError("");
            void request(
              "/availability",
              { available: !profile?.available },
              "PATCH",
            ).catch((e) => setAvailabilityError(e.message));
          }}
        />
        <T size={12} color={c.muted}>
          Going offline stops new offers. Your accepted jobs stay assigned.
        </T>
        {!!availabilityError && (
          <T color={c.red} accessibilityRole="alert">
            {availabilityError}
          </T>
        )}
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
      {profile?.type === "Partner" && <PartnerOffers />}
      <Row
        style={{
          backgroundColor: c.soft,
          borderRadius: 16,
          padding: 4,
          gap: 4,
        }}
      >
        {["active", "history"].map((x) => (
          <Pressable
            key={x}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === x }}
            onPress={() => setTab(x)}
            style={{
              padding: 14,
              borderRadius: 16,
              backgroundColor: tab === x ? c.white : "transparent",
              flex: 1,
            }}
          >
            <T bold size={12} style={{ textAlign: "center" }}>
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
  automations: "Automations",
  home: "Overview",
  bookings: "Orders & dispatch",
  workers: "Internal workers",
  quotes: "Quote requests",
  vendors: "Professionals",
  services: "Services",
  refunds: "Payments & refunds",
  support: "Customer support",
  reports: "Reports",
  settings: "Roles & settings",
  payouts: "Payouts & reconciliation",
  offers: "Offers",
  banners: "Promotional banners",
  growth: "Growth & marketing",
};
export function Dashboard() {
  const { tab = "home" } = useLocalSearchParams<{ tab: string }>(),
    { state } = useApp();
  if (!state) return null;
  const allowed =
    state.user.role === "owner" ||
    (state.user.role === "care" &&
      ["home", "bookings", "quotes", "workers", "refunds", "support"].includes(
        tab,
      ));
  if (!allowed)
    return (
      <Shell title="Access restricted">
        <Empty
          title="Owner access required"
          detail="This workspace is restricted to the Owner role."
        />
      </Shell>
    );
  if (
    Platform.OS !== "web" &&
    [
      "automations",
      "vendors",
      "services",
      "reports",
      "settings",
      "payouts",
      "offers",
      "banners",
      "growth",
    ].includes(tab)
  )
    return (
      <Shell title="Website configuration">
        <WebsiteConfiguration />
      </Shell>
    );
  return (
    <Shell title={titles[tab] || "Overview"}>
      {tab === "automations" ? (
        <Automations />
      ) : tab === "quotes" ? (
        <ServiceQuotes embedded />
      ) : tab === "home" ? (
        <AdminOverview table={<BookingTable compact />} />
      ) : tab === "bookings" ? (
        <BookingTable />
      ) : tab === "workers" ? (
        <InhouseWorkers />
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
      ) : tab === "banners" ? (
        <BannerManager />
      ) : tab === "offers" ? (
        <Promotions />
      ) : tab === "growth" ? (
        <Growth />
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
function BookingTable({ compact = false }: { compact?: boolean }) {
  const narrow = useWindowDimensions().width < 1100;
  const { state } = useApp();
  const { status: requestedStatus } = useLocalSearchParams<{
    status?: string;
  }>();
  const validStatuses = [
    "all",
    "awaiting_assignment",
    "assigned",
    "confirmed",
    "in_progress",
    "completed",
    "cancelled",
    "payment_pending",
    "payment_expired",
  ];
  const filter = validStatuses.includes(requestedStatus || "")
    ? requestedStatus!
    : "all";
  const [search, setSearch] = useState("");
  const list = usePagedRecords<Booking>(
    "bookings",
    filter === "all" ? "" : "status=" + filter,
  );
  let bookings = (compact ? state?.bookings || [] : list.rows).filter((b) =>
    (b.customerName + " " + b.serviceName + " " + b.id)
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  if (compact) bookings = bookings.slice(0, 5);
  return (
    <Card>
      <Row style={{ justifyContent: "space-between" }}>
        <T bold size={19}>
          {compact ? "Recent bookings" : "All bookings"}
        </T>
        <Badge
          label={`${bookings.length} ${compact ? "recent records" : "on this page"}`}
        />
      </Row>
      {!compact && (
        <>
          <Input
            label="Search bookings on this page"
            value={search}
            onChangeText={setSearch}
            placeholder="Customer, service or booking ID"
          />
          <ScrollView horizontal>
            <Row>
              {[
                "all",
                "awaiting_assignment",
                "assigned",
                "confirmed",
                "in_progress",
                "completed",
                "cancelled",
                "payment_pending",
                "payment_expired",
              ].map((f) => (
                <Pressable
                  key={f}
                  accessibilityRole="button"
                  accessibilityState={{ selected: f === filter }}
                  onPress={() => router.setParams({ status: f })}
                  style={{
                    padding: 10,
                    borderRadius: 12,
                    backgroundColor: f === filter ? c.mint : c.ivory,
                  }}
                >
                  <T size={12}>
                    {f === "all"
                      ? "All"
                      : f === "awaiting_assignment"
                        ? "Awaiting assignment"
                        : statusLabel(f)}
                  </T>
                </Pressable>
              ))}
            </Row>
          </ScrollView>
        </>
      )}
      {narrow ? (
        <StaffOrderCards bookings={bookings} />
      ) : (
        <ScrollView horizontal>
          <View style={{ minWidth: 1050, flex: 1 }}>
            <Row
              style={{ backgroundColor: c.soft, padding: 14, borderRadius: 12 }}
            >
              {[
                "Booking & customer",
                "Service",
                "Scheduled for",
                "Status",
                "Value",
                "Next action",
              ].map((x, i) => (
                <T
                  key={x}
                  size={11}
                  bold
                  color={c.muted}
                  style={{ width: [160, 180, 180, 150, 80, 180][i] }}
                >
                  {x}
                </T>
              ))}
            </Row>
            {bookings.map((b) => (
              <Pressable
                accessibilityRole="button"
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
                  <View style={{ width: 160 }}>
                    <T bold size={12}>
                      {b.customerName}
                    </T>
                    <T size={10} color={c.muted}>
                      #{b.id.slice(0, 8).toUpperCase()}
                    </T>
                  </View>
                  <T size={12} style={{ width: 180 }}>
                    {b.serviceName}
                  </T>
                  <T size={12} color={c.muted} style={{ width: 180 }}>
                    {dateLabel(b.slot)}
                  </T>
                  <View style={{ width: 150 }}>
                    <Badge
                      label={
                        b.status === "awaiting_assignment"
                          ? "Awaiting assignment"
                          : statusLabel(b.status)
                      }
                      tone={b.status === "cancelled" ? "red" : "green"}
                    />
                  </View>
                  <T size={12} bold style={{ width: 80 }}>
                    {money(b.total)}
                  </T>
                  <T size={12} color={c.green} style={{ width: 180 }}>
                    {orderNextAction(b)} →
                  </T>
                </Row>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
      {!compact && <PageControls list={list} label="bookings" />}
      {!compact && search.trim() !== "" && (
        <T size={12} color={c.muted}>
          Search applies to this page. Clear the search before moving between
          pages.
        </T>
      )}
      {!bookings.length && !(list.busy && !compact) && (
        <Empty
          title="No bookings match this view"
          detail="Choose another status or clear your search."
        />
      )}
      {compact && (
        <Button
          label="View all orders"
          secondary
          onPress={() => go("/dashboard/bookings")}
        />
      )}
    </Card>
  );
}
function Vendors() {
  const { state } = useApp();
  const list = usePagedRecords<Professional>("professionals"),
    [search, setSearch] = useState(""),
    [reviewFilter, setReviewFilter] = useState("all"),
    [approvalNotice, setApprovalNotice] = useState("");
  return (
    <>
      <Row style={{ flexWrap: "wrap" }}>
        {[
          ["all", "All professionals"],
          ["pending", "Review pending"],
          ["approved", "Approved"],
        ].map(([key, label]) => (
          <Button
            key={key}
            label={label}
            secondary={reviewFilter !== key}
            onPress={() => setReviewFilter(key)}
          />
        ))}
      </Row>
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
      {!!approvalNotice && (
        <T color={c.green} accessibilityLiveRegion="polite">
          {approvalNotice}
        </T>
      )}
      <PageControls list={list} label="professionals" />
      <View style={styles.grid}>
        {list.rows
          .filter(
            (p) =>
              !p.accountless &&
              (reviewFilter === "all" ||
                (reviewFilter === "approved" ? p.approved : !p.approved)) &&
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
              <VendorReview
                professional={p}
                onReviewed={(updated) => {
                  list.replace(updated.id, updated);
                  setApprovalNotice(
                    "Professional approved. They can now go available.",
                  );
                }}
              />
            </Card>
          ))}
      </View>
    </>
  );
}
function ServiceManager() {
  const { state } = useApp();
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [section, setSection] = useState("Services");
  const services =
    state?.services.filter(
      (s) =>
        (filter === "all" ||
          filter === (s.status || (s.active ? "active" : "draft"))) &&
        (s.name + " " + s.category)
          .toLowerCase()
          .includes(search.toLowerCase()),
    ) || [];
  return (
    <>
      <T size={23} bold>
        Your service catalogue
      </T>
      <Row style={{ flexWrap: "wrap" }}>
        {[
          "Services",
          "Categories",
          "Packages & pricing",
          "Add-on library",
          "Availability",
        ].map((name) => (
          <Button
            key={name}
            label={name}
            secondary={section !== name}
            onPress={() => setSection(name)}
          />
        ))}
      </Row>
      {section === "Categories" || section === "Add-on library" ? (
        <>
          <CatalogLibrary key={section} section={section} />
          {section === "Add-on library" && (
            <Card>
              <T bold>Manage service assignments</T>
              {(state?.services || []).map((s) => (
                <View key={s.id} style={{ gap: 4 }}>
                  <T>
                    {s.name} · {s.addons.length} assigned
                  </T>
                  <ServiceEditor
                    service={s}
                    initialStep={3}
                    label={"Manage extras for " + s.name}
                  />
                </View>
              ))}
            </Card>
          )}
        </>
      ) : (
        <>
          <Card>
            <T bold size={19}>
              {section}
            </T>
            <T color={c.muted}>
              {section === "Availability"
                ? "Set whether a service accepts new bookings. Staff schedules and service PIN codes determine the available times."
                : section === "Packages & pricing"
                  ? "Edit base prices, package scope and optional charges. Existing bookings keep the agreed amount."
                  : "Find a service by name or category, then review its scope and publication status."}
            </T>
            <Input
              label="Find a service to manage"
              value={search}
              onChangeText={setSearch}
              placeholder="Name or category"
            />
            <Row style={{ flexWrap: "wrap" }}>
              {Object.entries({
                all: "All services",
                active: "Published services",
                draft: "Service drafts",
                paused: "Paused",
                unavailable: "Unavailable",
              }).map(([key, label]) => (
                <Button
                  key={key}
                  label={label}
                  secondary={filter !== key}
                  onPress={() => setFilter(key)}
                />
              ))}
            </Row>
          </Card>
          {section === "Services" && <ServiceEditor />}
          {!services.length && (
            <Empty
              title="No matching services"
              detail="Try another name or publication status."
            />
          )}
          {services.map((s) => (
            <PriceEditor key={s.id + section} s={s} section={section} />
          ))}
        </>
      )}
    </>
  );
}
function PriceEditor({ s, section }: { s: Service; section: string }) {
  const { request, busy } = useApp();
  const [feedback, setFeedback] = useState("");
  const price = servicePricing(s);
  const status = s.status || (s.active ? "active" : "draft");
  return (
    <Card>
      <Row style={{ flexWrap: "wrap", justifyContent: "space-between" }}>
        <View style={{ gap: 4, flex: 1 }}>
          <T size={12} color={c.muted}>
            {[s.category, s.subcategory].filter(Boolean).join(" / ")}
          </T>
          <T bold size={18}>
            {s.name}
          </T>
        </View>
        <Badge
          label={
            {
              active: "Published",
              draft: "Draft",
              paused: "Paused",
              unavailable: "Unavailable",
            }[status]
          }
        />
      </Row>
      <T>
        {s.billingPeriod === "monthly"
          ? "Monthly subscription"
          : price.quoteOnly
            ? "Price by quotation"
            : price.minimum == null
              ? "Price pending"
              : (price.from ? "From " : "") + money(price.minimum)}{" "}
        · {s.packages?.length || 0} packages ·{" "}
        {s.addons.filter((a) => a.enabled !== false).length} add-ons
      </T>
      {!!s.updatedAt && (
        <T size={12} color={c.muted}>
          Updated {dateLabel(s.updatedAt)}
        </T>
      )}
      <ServiceEditor
        service={s}
        initialStep={
          section === "Availability"
            ? 4
            : section === "Packages & pricing"
              ? 1
              : 0
        }
        label={
          section === "Availability"
            ? "Manage availability"
            : section === "Packages & pricing"
              ? "Edit packages and pricing"
              : "Edit service details"
        }
      />
      {section === "Services" && (
        <>
          <ServiceEditor service={s} initialStep={5} label="Preview service" />
          <Button
            label="Duplicate as draft"
            secondary
            loading={busy}
            onPress={() =>
              void request("/services", {
                ...s,
                status: "draft",
                active: false,
                name: (s.name + " copy").slice(0, 100),
              })
                .then(() => setFeedback("Draft copy created."))
                .catch((e) => setFeedback(e.message))
            }
          />
        </>
      )}
      {!!feedback && <T accessibilityRole="alert">{feedback}</T>}
    </Card>
  );
}
function Refunds() {
  const { state, request, busy } = useApp();
  const list = usePagedRecords<Booking>("bookings", "queue=refunds");
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
          Customer Associates can review requests; only Admin / Owner can
          approve a refund.
        </T>
      </Card>
      <PageControls list={list} label="refunds" />
      {list.rows.map((b) => (
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
            <ConfirmAction
              label="Approve full refund"
              confirmLabel={"Refund " + money(b.total)}
              message={
                "Refund " +
                money(b.total) +
                " to " +
                b.customerName +
                " for " +
                b.serviceName +
                "?"
              }
              loading={busy}
              onConfirm={() =>
                request("/bookings/" + b.id + "/action", { action: "refund" })
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
      {!list.busy && !list.error && !list.rows.length && (
        <Empty
          title="No refund requests"
          detail="Cancelled paid bookings create a refund request here."
        />
      )}
    </>
  );
}
function Requests() {
  const [drafts, setDrafts] = useState<Record<string, SupportDraft>>({});
  const [queue, setQueue] = useState("open");
  const [expanded, setExpanded] = useState<string | null | undefined>(
    undefined,
  );
  const list = usePagedRecords<Ticket>(
    "tickets",
    queue === "all"
      ? ""
      : queue === "quality"
        ? "status=open&priority=high"
        : "status=open",
  );
  const activeTicket = expanded === undefined ? list.rows[0]?.id : expanded;
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
        list.rows
          .slice()
          .sort(
            (a, b) =>
              (a.responseDueAt || a.createdAt) -
              (b.responseDueAt || b.createdAt),
          )
          .map((t) => (
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
              {!!(t.escalatedAt && t.status === "open") && (
                <Badge label="Response overdue · escalated" tone="amber" />
              )}
              {!!(t.responseDueAt && t.status === "open") && (
                <T size={12} color={c.muted}>
                  {"Response target: " + dateLabel(t.responseDueAt)}
                </T>
              )}
              {!!t.category && (
                <T size={12} color={c.muted}>
                  {"Topic: " + t.category}
                </T>
              )}
              {!!t.bookingId && (
                <Button
                  label={
                    "View booking #" + t.bookingId.slice(0, 8).toUpperCase()
                  }
                  secondary
                  onPress={() => go("/booking/" + t.bookingId)}
                />
              )}
              <T numberOfLines={activeTicket === t.id ? undefined : 2}>
                {t.message}
              </T>
              <Button
                label={
                  activeTicket === t.id
                    ? "Close conversation"
                    : "Open conversation"
                }
                secondary
                onPress={() => setExpanded(activeTicket === t.id ? null : t.id)}
              />
              {activeTicket === t.id && (
                <SupportReply
                  ticket={t}
                  draft={drafts[t.id]}
                  onDraftChange={(change) =>
                    setDrafts((old) => ({
                      ...old,
                      [t.id]: { ...old[t.id], ...change },
                    }))
                  }
                />
              )}
              <T color={c.muted} size={11}>
                {dateLabel(t.createdAt)} · #{t.id.slice(0, 8)}
              </T>
            </Card>
          ))
      ) : !list.busy && !list.error ? (
        <Empty
          title="No conversations in this view"
          detail="Choose another queue or return when a customer submits a request."
        />
      ) : null}
    </>
  );
}
function Reports() {
  const [section, setSection] = useState("performance");
  const { state } = useApp();
  const audit = usePagedRecords<AppState["audit"][number]>("audit");
  if (!state) return null;
  return (
    <>
      <Row style={{ flexWrap: "wrap" }}>
        {[
          ["performance", "Performance"],
          ["export", "Export report"],
          ["audit", "Staff activity"],
        ].map(([key, label]) => (
          <Button
            key={key}
            label={label}
            secondary={section !== key}
            onPress={() => setSection(key)}
          />
        ))}
      </Row>
      {section === "export" && <ExportReport />}
      {section === "performance" && (
        <>
          <DateRangeSummary />
        </>
      )}
      {section === "audit" && (
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
      )}
    </>
  );
}
function Settings() {
  const { section = "dispatch" } = useLocalSearchParams<{ section?: string }>();
  return (
    <>
      <Row style={{ flexWrap: "wrap" }}>
        {[
          ["dispatch", "Office dispatch"],
          ["policies", "Business & policies"],
          ["about", "About page"],
          ["staff", "Staff access"],
          ["setup", "Setup & launch"],
        ].map(([key, label]) => (
          <Button
            key={key}
            label={label}
            secondary={section !== key}
            onPress={() => router.setParams({ section: key })}
          />
        ))}
      </Row>
      {section === "setup" ? (
        <>
          <OwnerSetupGuide />
          <LaunchReadiness />
        </>
      ) : (
        <CompanySettings />
      )}
    </>
  );
}
