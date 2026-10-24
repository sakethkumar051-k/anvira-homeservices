import AboutEditor from "./AboutEditor";
import CommissionSettings from "./CommissionSettings";
import React, { useState } from "react";
import PayoutControls from "./PayoutControls";
import { View, Linking, Platform } from "react-native";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { useApp } from "../lib/context";
import {
  AppState,
  Professional,
  Service,
  Ticket,
  money,
  dateLabel,
  CommissionForm,
  defaultCommissionTiers,
  parseCommissionForm,
} from "../lib/model";
import { T, c, Card, Row, Button, Input, Badge, Divider } from "./ui";
import { Choice } from "./Experience";
import { usePagedRecords, PageControls } from "./PagedRecords";
import {
  ServiceCustomizationEditor,
  cleanService,
  ServiceCare,
} from "./ServiceCustomization";
const emptyService = {
  fulfillmentType: "visit" as "visit" | "laundry",
  sampleReviewed: false,
  bookingFields: [],
  packages: [],
  optionGroups: [],
  faqs: [],
  preparation: [],
  checklist: [],
  warranty: "",
  name: "",
  nameTe: "",
  category: "Cleaning",
  icon: "spark",
  price: 100,
  duration: 60,
  headline: "",
  description: "",
  descriptionTe: "",
  includes: [],
  excludes: [],
  addons: [],
  active: false,
  order: 0,
};
export function ServiceEditor({ service }: { service?: Service }) {
  const { request, busy, state } = useApp(),
    [editing, setEditing] = useState(false),
    [saved, setSaved] = useState(false),
    [saveError, setSaveError] = useState(""),
    [preview, setPreview] = useState(false),
    [form, setForm] = useState(service || emptyService);
  const set = (key: string, value: unknown) => {
    setSaved(false);
    setSaveError("");
    setForm((f) => ({ ...f, [key]: value }));
  };
  if (!editing)
    return (
      <View style={{ gap: 8 }}>
        {saved && <Badge label="Service saved" />}
        <Button
          label={service ? "Edit service details" : "Create a service"}
          secondary
          onPress={() => {
            setForm(service || emptyService);
            setSaveError("");
            setSaved(false);
            setPreview(false);
            setEditing(true);
          }}
        />
      </View>
    );
  return (
    <Card style={{ flexGrow: 1, minWidth: 260, maxWidth: 620 }}>
      <T bold size={20}>
        {service ? "Service details" : "New service"}
      </T>
      {[
        ["name", "Service name"],
        ["nameTe", "Service name in Telugu"],
        ["category", "Category"],
        ["headline", "Headline"],
        ["description", "Description"],
        ["descriptionTe", "Description in Telugu"],
      ].map(([key, label]) => (
        <Input
          key={key}
          label={label}
          value={String(form[key as keyof typeof form] || "")}
          onChangeText={(value) => set(key, value)}
          multiline={key.startsWith("description")}
        />
      ))}
      <Input
        label="Icon (spark, air, water, bolt, roller, tool)"
        value={form.icon}
        onChangeText={(value) => set("icon", value)}
      />
      <Row>
        {[
          ["price", "Price (₹)"],
          ["duration", "Duration (minutes)"],
          ["order", "Display order"],
        ].map(([key, label]) => (
          <View key={key} style={{ flex: 1 }}>
            <Input
              label={label}
              value={String(form[key as keyof typeof form])}
              keyboardType="number-pad"
              onChangeText={(v) => set(key, Number(v))}
            />
          </View>
        ))}
      </Row>
      <Input
        label="What is included (one item per line)"
        value={form.includes.join("\n")}
        onChangeText={(v) => set("includes", v.split("\n"))}
        multiline
      />
      <Input
        label="Not included (one item per line)"
        value={form.excludes?.join("\n") || ""}
        onChangeText={(v) => set("excludes", v.split("\n").filter(Boolean))}
        multiline
      />
      <T bold>Optional add-ons</T>
      {form.addons.map((a, i) => (
        <Card key={i} style={{ backgroundColor: c.ivory }}>
          <Input
            label="Add-on name"
            value={a.name}
            onChangeText={(v) =>
              set(
                "addons",
                form.addons.map((x, j) => (j === i ? { ...x, name: v } : x)),
              )
            }
          />
          <Input
            label="Add-on price (₹)"
            value={String(a.price)}
            keyboardType="number-pad"
            onChangeText={(v) =>
              set(
                "addons",
                form.addons.map((x, j) =>
                  j === i ? { ...x, price: Number(v) } : x,
                ),
              )
            }
          />
          <Button
            label="Remove add-on"
            secondary
            onPress={() =>
              set(
                "addons",
                form.addons.filter((_, j) => j !== i),
              )
            }
          />
        </Card>
      ))}
      <Button
        label="Add an add-on"
        secondary
        onPress={() =>
          set("addons", [
            ...form.addons,
            { id: "addon-" + Date.now(), name: "", price: 100 },
          ])
        }
      />
      <ServiceCustomizationEditor value={form} onChange={set} />
      <Button
        label={preview ? "Hide service preview" : "Preview service"}
        secondary
        onPress={() => setPreview(!preview)}
      />
      {preview && (
        <Card style={{ backgroundColor: c.mint }}>
          <T bold size={22}>
            {form.name || "Your service"}
          </T>
          <T>{form.headline}</T>
          <T>{form.description}</T>
          <T>{money(form.price) + " · " + form.duration + " minutes"}</T>
          {form.includes.filter(Boolean).map((x, i) => (
            <T key={i}>{"• " + x}</T>
          ))}
          <ServiceCare service={cleanService(form)} />
        </Card>
      )}
      {state?.mode === "firebase" && service?.sample && (
        <Card style={{ backgroundColor: c.amberbg }}>
          <T bold>Review this sample before publishing</T>
          <T>
            Approve the real price, all package options, scope, exclusions and
            warranty terms. Sample text is a starting point for your business.
          </T>
          <Choice
            label="I reviewed and approved this service scope and prices"
            checked={!!form.sampleReviewed}
            onPress={() => set("sampleReviewed", !form.sampleReviewed)}
          />
        </Card>
      )}
      <Choice
        label="Available to customers"
        checked={form.active}
        onPress={() => set("active", !form.active)}
      />
      <Button
        label="Save service"
        loading={busy}
        onPress={() =>
          void request(
            "/services" + (service ? "/" + service.id : ""),
            cleanService(form),
            service ? "PATCH" : "POST",
          )
            .then(() => {
              setSaved(true);
              setEditing(false);
            })
            .catch((e) => setSaveError(e.message))
        }
      />
      {!!saveError && (
        <T accessibilityRole="alert" color={c.red}>
          {saveError}
        </T>
      )}
      {saved && <Badge label="Service saved" />}
      {service && (
        <Button
          label="Close details"
          secondary
          onPress={() => setEditing(false)}
        />
      )}
    </Card>
  );
}
export function VendorReview({
  professional: p,
}: {
  professional: Professional;
}) {
  const { state, read, request, busy } = useApp(),
    [verified, setVerified] = useState(false),
    [reason, setReason] = useState(""),
    [message, setMessage] = useState("");
  return (
    <>
      <Button
        label={
          p.type === "Partner" ? "Change to in-house" : "Change to partner"
        }
        secondary
        disabled={busy}
        onPress={() =>
          void request(
            "/professionals/" + p.id + "/type",
            { type: p.type === "Partner" ? "In-house" : "Partner" },
            "PATCH",
          ).catch(() => {})
        }
      />
      <T color={c.muted}>{p.bio}</T>
      <T size={12}>Coverage: {p.pins?.join(", ")}</T>
      {p.documents?.map((d) => (
        <Button
          key={d.id}
          label={
            d.kind === "identity"
              ? "Review identity document"
              : "Review skill certificate"
          }
          secondary
          onPress={() =>
            void read<{ url: string }>(
              "/professionals/" + p.id + "/documents/" + d.id,
            )
              .then((data) => Linking.openURL(data.url))
              .catch((e) => setMessage(e.message))
          }
        />
      ))}
      {!p.approved && (
        <>
          <Choice
            label="I have verified identity, skills and coverage"
            checked={verified}
            onPress={() => setVerified(!verified)}
          />
          <Button
            label="Approve professional"
            disabled={state?.mode !== "demo" && !verified}
            loading={busy}
            onPress={() =>
              void request("/professionals/" + p.id + "/approve", {
                verificationConfirmed: verified,
              }).catch(() => {})
            }
          />
          <Input
            label="Changes required"
            value={reason}
            onChangeText={setReason}
            multiline
          />
          <Button
            label="Request profile changes"
            secondary
            disabled={reason.trim().length < 5}
            loading={busy}
            onPress={() =>
              void request("/professionals/" + p.id + "/reject", {
                reason,
              }).catch(() => {})
            }
          />
        </>
      )}
      {message && <T color={c.red}>{message}</T>}
    </>
  );
}
export function SupportReply({ ticket: t }: { ticket: Ticket }) {
  const { request, busy, state } = useApp(),
    [message, setMessage] = useState(""),
    [resolution, setResolution] = useState(""),
    [feedback, setFeedback] = useState(""),
    [replyKey, setReplyKey] = useState(
      () => "reply-" + Date.now() + "-" + Math.random().toString(36).slice(2),
    );
  const requester =
    state?.user.role === "customer" || state?.user.role === "professional";
  return (
    <>
      {!!feedback && (
        <T accessibilityRole="alert" color={c.green}>
          {feedback}
        </T>
      )}
      {t.messages?.map((m, i) => (
        <Card key={i} style={{ backgroundColor: c.mint }}>
          <T bold>{m.sender}</T>
          <T>{m.message}</T>
          <T size={11} color={c.muted}>
            {dateLabel(m.at)}
          </T>
        </Card>
      ))}
      {!requester && t.status === "open" && (
        <>
          <Input
            label="Resolution summary"
            placeholder="Explain what was done and any next steps"
            value={resolution}
            onChangeText={setResolution}
            multiline
          />
          <Button
            label="Resolve request"
            secondary
            loading={busy}
            disabled={resolution.trim().length < 8}
            onPress={() =>
              void request("/tickets/" + t.id + "/resolve", { resolution })
                .then(() => {
                  setResolution("");
                  setFeedback("Request resolved.");
                })
                .catch((e) => setFeedback(e.message))
            }
          />
        </>
      )}
      {(t.status === "open" || requester) && (
        <>
          <Input
            label={requester ? "Add a follow-up" : "Reply to customer"}
            value={message}
            onChangeText={setMessage}
            multiline
          />
          <Button
            label={t.status === "resolved" ? "Reopen request" : "Send reply"}
            loading={busy}
            disabled={message.trim().length < 2}
            onPress={() =>
              void request("/tickets/" + t.id + "/reply", {
                message,
                idempotencyKey: replyKey,
              })
                .then(() => {
                  setMessage("");
                  setFeedback("Reply sent.");
                  setReplyKey(
                    "reply-" +
                      Date.now() +
                      "-" +
                      Math.random().toString(36).slice(2),
                  );
                })
                .catch((e) => setFeedback(e.message))
            }
          />
        </>
      )}
    </>
  );
}
export function CompanySettings() {
  const staff = usePagedRecords<AppState["staff"][number]>("staff");
  const { state, request, busy } = useApp(),
    [form, setForm] = useState(state!.settings),
    [pins, setPins] = useState(state!.settings.pins.join(",")),
    [saved, setSaved] = useState(false),
    [settingsError, setSettingsError] = useState(""),
    [commissionForm, setCommissionForm] = useState<CommissionForm>(() => ({
      mode: state!.settings.commissionMode || "flat",
      flatPercent: String(state!.settings.commissionBps / 100),
      tiers: (state!.settings.commissionTiers || defaultCommissionTiers).map(
        (tier) => ({
          minAmount: String(tier.minAmount),
          percent: String(tier.commissionBps / 100),
        }),
      ),
    })),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [staffError, setStaffError] = useState(""),
    [createdEmail, setCreatedEmail] = useState("");
  const set = (key: string, value: unknown) => {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: value }));
  };
  return (
    <>
      <AboutEditor />
      <Card>
        <T bold size={22}>
          Service rules & policies
        </T>
        <Choice
          label="Use REVIEW-ONLY policies for Razorpay test payments"
          checked={form.policyEnvironment === "test"}
          onPress={() => {
            set(
              "policyEnvironment",
              form.policyEnvironment === "test" ? "production" : "test",
            );
            set("policyPublished", false);
          }}
        />
        <T color={c.muted}>
          {form.policyEnvironment === "test"
            ? "Review only: fictional SAMPLE services, prices and professionals. No real orders, service delivery or settlements. Support: anviraservicesllp@gmail.com. A support phone is optional for this test environment."
            : "Production requires client-approved policies, legal business details, a support phone and approved service prices. Changing the policy environment requires a fresh policy approval."}
        </T>
        {[
          ["name", "Company name"],
          ["supportPhone", "Support phone (+91)"],
          ["termsVersion", "Policy version"],
          ["termsUrl", "Published terms URL"],
          ["privacyUrl", "Published privacy URL"],
        ].map(([key, label]) => (
          <Input
            key={key}
            label={label}
            value={String(form[key as keyof typeof form] || "")}
            onChangeText={(v) => set(key, v)}
            autoCapitalize="none"
          />
        ))}
        <Input label="Service PIN codes" value={pins} onChangeText={setPins} />
        {[
          ["cancelCutoffHours", "Cancellation cutoff (hours)"],
          ["assignmentDeadlineMinutes", "Assignment deadline (minutes)"],
        ].map(([key, label]) => (
          <Input
            key={key}
            label={label}
            value={String(form[key as keyof typeof form])}
            onChangeText={(v) => set(key, Number(v))}
            keyboardType="number-pad"
          />
        ))}
        <CommissionSettings
          form={commissionForm}
          onChange={(value) => {
            setCommissionForm(value);
            setSaved(false);
            setSettingsError("");
          }}
        />
        <Choice
          label={
            form.policyEnvironment === "test"
              ? "Review-only policies published; enable test bookings"
              : "Production policies approved by the business and published; enable bookings"
          }
          checked={form.policyPublished}
          onPress={() => set("policyPublished", !form.policyPublished)}
        />
        <Button
          label="Save company settings"
          loading={busy}
          onPress={() => {
            let commission;
            try {
              commission = parseCommissionForm(commissionForm);
            } catch (e) {
              setSettingsError(
                e instanceof Error
                  ? e.message
                  : "Check the commission settings.",
              );
              return;
            }
            setSettingsError("");
            void request(
              "/settings",
              {
                ...form,
                ...commission,
                pins: pins.split(",").map((x) => x.trim()),
              },
              "PUT",
            )
              .then(() => setSaved(true))
              .catch((e) =>
                setSettingsError(
                  e instanceof Error
                    ? e.message
                    : "Settings could not be saved.",
                ),
              );
          }}
        />
        {settingsError && (
          <T color={c.red} accessibilityRole="alert">
            {settingsError}
          </T>
        )}
        {saved && <Badge label="Settings saved" />}
      </Card>
      <Card>
        <T bold size={22}>
          Staff access
        </T>
        <T color={c.muted}>
          The Owner manages services, professionals and money approvals.
          Customer Care manages bookings, assignments and support.
        </T>
        <PageControls list={staff} label="staff" />
        {staff.rows.map((u) => (
          <Card key={u.id} style={{ backgroundColor: c.ivory }}>
            <T bold>{u.name}</T>
            <T>{u.email || u.role}</T>
            <Badge label={u.active ? "Active" : "Disabled"} />
            {u.role === "care" && (
              <Button
                label={
                  u.active ? "Disable staff access" : "Enable staff access"
                }
                secondary
                loading={busy}
                onPress={() =>
                  void request("/staff/" + u.id + "/status", {
                    active: !u.active,
                  }).catch(() => {})
                }
              />
            )}
          </Card>
        ))}
        <Divider />
        <T bold>Add Customer Care staff</T>
        <T color={c.muted}>
          Choose a new staff email and an app password. Share them directly with
          your Customer Care team member so they can sign in to the staff
          portal.
        </T>
        <Input label="Staff name" value={name} onChangeText={setName} />
        <Input
          label="Staff email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!busy}
        />
        <Input
          label="Staff password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          editable={!busy}
          maxLength={128}
        />
        <T size={12} color={c.muted}>
          Use at least 8 characters.
        </T>
        <Input
          label="Confirm staff password"
          value={confirmation}
          onChangeText={setConfirmation}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          editable={!busy}
          maxLength={128}
        />
        {staffError && (
          <T accessibilityRole="alert" color={c.red}>
            {staffError}
          </T>
        )}
        <Button
          label="Create staff account"
          loading={busy}
          onPress={() => {
            setStaffError("");
            setCreatedEmail("");
            if (password.length < 8) {
              setStaffError(
                "Use at least 8 characters for the staff password.",
              );
              return;
            }
            if (password !== confirmation) {
              setStaffError("Staff passwords do not match.");
              return;
            }
            void request("/staff", {
              name,
              email: email.trim(),
              password,
              role: "care",
            })
              .then(() => {
                setCreatedEmail(email.trim());
                setName("");
                setEmail("");
                setPassword("");
                setConfirmation("");
              })
              .catch((e) => setStaffError(e.message));
          }}
        />
        {createdEmail && (
          <Card style={{ backgroundColor: c.mint }}>
            <T bold accessibilityLiveRegion="polite">
              Customer Care account created
            </T>
            <T size={12}>
              Share this email and the password you chose with the intended team
              member through your trusted channel. They can use Reset password
              on the staff portal if needed.
            </T>
            <T selectable size={12}>
              {createdEmail}
            </T>
            <Button
              label="Dismiss account confirmation"
              secondary
              onPress={() => setCreatedEmail("")}
            />
          </Card>
        )}
      </Card>
    </>
  );
}
export function Promotions() {
  const { state, request, busy } = useApp(),
    [code, setCode] = useState(""),
    [discount, setDiscount] = useState("100"),
    [minimum, setMinimum] = useState("500"),
    [uses, setUses] = useState("100"),
    [expiry, setExpiry] = useState(() =>
      new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    );
  return (
    <>
      <Card>
        <T bold size={22}>
          Create or update an offer
        </T>
        <Input
          label="Offer code"
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
        />
        <Input
          label="Discount (₹)"
          value={discount}
          onChangeText={setDiscount}
          keyboardType="number-pad"
        />
        <Input
          label="Minimum service value (₹)"
          value={minimum}
          onChangeText={setMinimum}
          keyboardType="number-pad"
        />
        <Input
          label="Maximum uses"
          value={uses}
          onChangeText={setUses}
          keyboardType="number-pad"
        />
        <Input
          label="Valid through (YYYY-MM-DD)"
          value={expiry}
          onChangeText={setExpiry}
        />
        <Button
          label="Save offer"
          loading={busy}
          onPress={() =>
            void request(
              "/promotions",
              {
                id: code.toUpperCase(),
                discountAmount: Number(discount),
                minAmount: Number(minimum),
                maxUses: Number(uses),
                expiresAt: Date.parse(expiry + "T18:29:59Z"),
                active: true,
              },
              "PUT",
            )
              .then(() => setCode(""))
              .catch(() => {})
          }
        />
      </Card>
      {state?.promotions.map((p) => (
        <Card key={p.id}>
          <T bold>{p.id}</T>
          <T>
            {money(p.discountAmount)} off · minimum {money(p.minAmount)}
          </T>
          <T size={12}>{dateLabel(p.expiresAt)}</T>
          <Button
            label="Disable offer"
            secondary
            loading={busy}
            onPress={() =>
              void request("/promotions", { ...p, active: false }, "PUT").catch(
                () => {},
              )
            }
          />
        </Card>
      ))}
    </>
  );
}
export function FinancialOperations() {
  const payouts = usePagedRecords<AppState["payouts"][number]>("payouts");
  const { state, request, busy } = useApp(),
    [kind, setKind] = useState("refund"),
    [target, setTarget] = useState(""),
    [provider, setProvider] = useState(""),
    [message, setMessage] = useState("");
  return (
    <>
      <Card style={{ backgroundColor: c.mint }}>
        <T bold size={22}>
          Partner payouts
        </T>
        <T>
          Balances move to a held state when a partner requests withdrawal. Only
          the Owner can approve or reject it.
        </T>
      </Card>
      <PayoutControls />
      <PageControls list={payouts} label="payouts" />
      {payouts.rows.map((p) => (
        <Card key={p.id}>
          <Row style={{ justifyContent: "space-between" }}>
            <T bold>{p.professionalName}</T>
            <T bold>{money(p.amount)}</T>
          </Row>
          <Badge label={p.status} />
          <T selectable size={11}>
            {p.id}
          </T>
          {p.status === "requested" && (
            <>
              <Button
                label="Approve payout"
                loading={busy}
                onPress={() =>
                  void request("/payouts/" + p.id + "/approve", {}).catch(
                    () => {},
                  )
                }
              />
              <Button
                label="Reject payout"
                secondary
                loading={busy}
                onPress={() =>
                  void request("/payouts/" + p.id + "/reject", {}).catch(
                    () => {},
                  )
                }
              />
            </>
          )}
        </Card>
      ))}
      <Card>
        <T bold size={22}>
          Payment reconciliation
        </T>
        <T color={c.muted}>
          Use the provider dashboard to find an uncertain order, refund or
          payout. ANVIRA checks the amount and linked booking before recording
          it.
        </T>
        {state?.financialJobs.map((j) => (
          <Card key={j.id} style={{ backgroundColor: c.amberbg }}>
            <T bold>
              {j.type} · {j.status}
            </T>
            <T selectable size={11}>
              {j.bookingId || j.payoutId}
            </T>
            <T size={11}>{j.errorCode}</T>
          </Card>
        ))}
        <Row>
          {["order", "refund", "payout"].map((k) => (
            <View key={k} style={{ flex: 1 }}>
              <Choice
                label={k}
                checked={kind === k}
                onPress={() => setKind(k)}
              />
            </View>
          ))}
        </Row>
        <Input
          label="Booking or payout ID"
          value={target}
          onChangeText={setTarget}
          autoCapitalize="none"
        />
        <Input
          label="Provider order, refund or payout ID"
          value={provider}
          onChangeText={setProvider}
          autoCapitalize="none"
        />
        <Button
          label="Verify provider record"
          loading={busy}
          onPress={() =>
            void request(
              "/reconcile/" + kind,
              kind === "payout"
                ? { payoutId: target, gatewayId: provider }
                : {
                    bookingId: target,
                    [kind === "order" ? "orderId" : "refundId"]: provider,
                  },
            )
              .then(() => setMessage("Provider record verified."))
              .catch(() => {})
          }
        />
        <Button
          label="Run pending operations"
          secondary
          loading={busy}
          onPress={() =>
            void request("/operations/run", {})
              .then(() => setMessage("Pending operations checked."))
              .catch(() => {})
          }
        />
        {message && <T>{message}</T>}
      </Card>
    </>
  );
}
export function ExportReport() {
  const { download } = useApp(),
    [from, setFrom] = useState(() =>
      new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
    ),
    [to, setTo] = useState(() => new Date().toISOString().slice(0, 10)),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function exportCsv() {
    setBusy(true);
    try {
      const blob = await download(
        "/reports/export?from=" +
          Date.parse(from + "T00:00:00+05:30") +
          "&to=" +
          Date.parse(to + "T23:59:59+05:30"),
      );
      if (Platform.OS === "web") {
        const url = URL.createObjectURL(blob),
          a = document.createElement("a");
        a.href = url;
        a.download = "anvira-bookings.csv";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        const file = new File(Paths.cache, "anvira-bookings.csv");
        file.write(await blob.text());
        if (await Sharing.isAvailableAsync())
          await Sharing.shareAsync(file.uri, { mimeType: "text/csv" });
      }
      setMessage("Report exported.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <T bold size={20}>
        Export booking report
      </T>
      <T size={12} color={c.muted}>
        Up to 31 days per export. Dates use Indian Standard Time.
      </T>
      <Input label="From (YYYY-MM-DD)" value={from} onChangeText={setFrom} />
      <Input label="To (YYYY-MM-DD)" value={to} onChangeText={setTo} />
      <Button
        label="Export CSV"
        loading={busy}
        onPress={() => void exportCsv()}
      />
      {message && <T>{message}</T>}
    </Card>
  );
}
