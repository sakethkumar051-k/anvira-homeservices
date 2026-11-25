import { ServicePhoto, servicePhotos } from "./ServicePhoto";
import { ServiceAddonsEditor } from "./ServiceAddonsEditor";
import { servicePricing } from "../lib/service-catalog";
import { validateServiceConfiguration } from "../lib/service-management";
import { router, useLocalSearchParams } from "expo-router";
import AboutEditor from "./AboutEditor";
import OfficeDispatchSettings from "./OfficeDispatchSettings";
import WebsiteConfiguration from "./WebsiteConfiguration";
import { validateServiceBasics } from "../lib/office-ui";
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
const editorSteps = [
  "Basics",
  "Pricing",
  "Packages & scope",
  "Add-ons",
  "Availability",
  "Preview & publish",
];
type ServiceForm = Omit<Service, "id"> & { id?: string };
const emptyService: ServiceForm = {
  bookingMode: "instant" as "instant" | "quote",
  packageRequired: false,
  priceUnit: "",
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
  category: "",
  icon: "spark",
  price: 0,
  duration: 60,
  headline: "",
  description: "",
  descriptionTe: "",
  includes: [],
  excludes: [],
  addons: [],
  active: false,
  partnerFulfillmentAllowed: true,
  order: 0,
};
export function ServiceEditor({
  service,
  initialStep = 0,
  label,
}: {
  service?: Service;
  initialStep?: number;
  label?: string;
}) {
  const { request, busy, state } = useApp();
  const [editing, setEditing] = useState(false),
    [advanced, setAdvanced] = useState(false);
  const [saved, setSaved] = useState(false),
    [saveError, setSaveError] = useState("");
  const [step, setStep] = useState(initialStep),
    [form, setForm] = useState(service || emptyService);
  const set = (key: string, value: unknown) => {
    setSaved(false);
    setSaveError("");
    setForm((f) => ({ ...f, [key]: value }));
  };
  if (Platform.OS !== "web") return <WebsiteConfiguration />;
  if (!editing)
    return (
      <View style={{ gap: 8 }}>
        {saved && <Badge label="Service saved" />}
        <Button
          label={
            label || (service ? "Edit service details" : "Create a service")
          }
          secondary
          onPress={() => {
            setForm(service || emptyService);
            setSaveError("");
            setSaved(false);
            setStep(initialStep);
            setAdvanced(false);
            setEditing(true);
          }}
        />
      </View>
    );
  async function save() {
    const error =
      validateServiceBasics(form) ||
      validateServiceConfiguration(form) ||
      (form.active &&
      form.bookingMode !== "quote" &&
      servicePricing(form).minimum === null
        ? "No package and required-choice combination fits the booking limits. Reduce the duration or price, or use tailored quotes."
        : "");
    if (error) {
      setSaveError(error);
      return;
    }
    if (
      form.active &&
      state?.mode === "firebase" &&
      service?.sample &&
      !form.sampleReviewed
    ) {
      setSaveError(
        "Review and approve this sample's scope and prices before publishing.",
      );
      return;
    }
    setSaveError("");
    try {
      await request(
        "/services" + (service ? "/" + service.id : ""),
        cleanService({
          ...form,
          ...(service ? { updatedAt: form.updatedAt || 0 } : {}),
          name: form.name.trim(),
          category: form.category.trim(),
          description: form.description.trim(),
        }),
        service ? "PATCH" : "POST",
      );
      setSaved(true);
      setEditing(false);
    } catch (e) {
      setSaveError((e as Error).message);
    }
  }
  return (
    <Card style={{ flexGrow: 1, minWidth: 260, maxWidth: 620 }}>
      <T bold size={20}>
        {service ? "Service details" : "New service"}
      </T>
      <Badge
        label={
          form.active ? "Publish to customers" : "Draft · hidden from customers"
        }
        tone={form.active ? "green" : "amber"}
      />
      <T bold size={16}>
        Step {step + 1} of {editorSteps.length} · {editorSteps[step]}
      </T>
      <Row style={{ flexWrap: "wrap" }}>
        {editorSteps.map((name, index) => (
          <Button
            key={name}
            label={name}
            secondary={step !== index}
            onPress={() => setStep(index)}
          />
        ))}
      </Row>
      {step === 0 && (
        <>
          <Input
            label="Service name"
            value={form.name}
            onChangeText={(v) => set("name", v)}
            maxLength={100}
          />
          <Input
            label="Category"
            value={form.category}
            onChangeText={(v) => set("category", v)}
            maxLength={40}
          />
          <Row style={{ flexWrap: "wrap" }}>
            {Array.from(
              new Set([
                ...(state?.catalogLibrary?.categories || []),
                ...(state?.services || []).map((s) => s.category),
              ]),
            )
              .sort()
              .map((category) => (
                <Button
                  key={category}
                  label={category}
                  secondary={category !== form.category}
                  onPress={() => set("category", category)}
                />
              ))}
          </Row>
          <Input
            label="Subcategory (optional)"
            value={form.subcategory || ""}
            maxLength={80}
            onChangeText={(v) => set("subcategory", v)}
          />
          <Input
            label="Short description"
            value={form.headline}
            maxLength={160}
            onChangeText={(v) => set("headline", v)}
          />
          <Input
            label="Description"
            value={form.description}
            onChangeText={(v) => set("description", v)}
            multiline
            maxLength={1000}
          />
          <T bold>Service photo</T>
          <ServicePhoto service={{ ...form, id: form.id || "" }} />
          <Row style={{ flexWrap: "wrap" }}>
            {[
              ["", "Automatic"],
              ...Object.keys(servicePhotos).map((key) => [
                key,
                (
                  {
                    home: "Home cleaning",
                    ac: "AC",
                    ro: "Water purifier",
                  } as Record<string, string>
                )[key] || key[0].toUpperCase() + key.slice(1),
              ]),
            ].map(([key, name]) => (
              <Button
                key={key}
                secondary={(form.photoKey || "") !== key}
                label={name}
                onPress={() => set("photoKey", key)}
              />
            ))}
          </Row>
        </>
      )}
      {step === 1 && (
        <>
          <T bold>How customers book</T>
          <Choice
            label="Book at a published price"
            checked={form.bookingMode !== "quote"}
            onPress={() => {
              set("billingPeriod", "one_time");
              set("bookingMode", "instant");
            }}
          />
          <Choice
            label="Request a tailored quote"
            checked={
              form.bookingMode === "quote" && form.billingPeriod !== "monthly"
            }
            onPress={() => {
              set("billingPeriod", "one_time");
              set("bookingMode", "quote");
            }}
          />
          <Choice
            label="Monthly subscription"
            checked={form.billingPeriod === "monthly"}
            onPress={() => {
              set("billingPeriod", "monthly");
              set("bookingMode", "quote");
            }}
          />
          <T size={12} color={c.muted}>
            {form.billingPeriod === "monthly"
              ? "Share the monthly price and visit frequency. The team arranges starts and payments with the customer."
              : form.bookingMode === "quote"
                ? "Customers request a quote. They cannot pay a standard catalog price; your team confirms the work and price first. Catalog prices below remain internal configuration until you enable published-price booking."
                : "Customers choose a package or standard service, then any required options and optional add-ons."}
          </T>
          <Input
            label="What one base booking covers"
            placeholder="For example: one appliance, one vehicle, or a defined laundry load"
            value={form.priceUnit || ""}
            maxLength={100}
            onChangeText={(v) => set("priceUnit", v)}
          />
          {form.bookingMode !== "quote" && (
            <>
              {form.packageRequired ? (
                <Card style={{ backgroundColor: c.mint }}>
                  <T bold size={18}>
                    Prices customers pay
                  </T>
                  {(form.packages || []).map((pack) => (
                    <Row
                      key={pack.id}
                      style={{
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                      }}
                    >
                      <T size={13} style={{ flex: 1 }}>
                        {pack.name}
                      </T>
                      <T bold color={c.green}>
                        {money(pack.price)}
                      </T>
                    </Row>
                  ))}
                  <Button
                    label="Edit service option prices"
                    secondary
                    onPress={() => setStep(2)}
                  />
                </Card>
              ) : (
                <Input
                  label="Price (₹)"
                  value={form.price ? String(form.price) : ""}
                  onChangeText={(v) => set("price", Number(v))}
                  keyboardType="number-pad"
                />
              )}
              <T size={12} color={c.muted}>
                {form.packageRequired
                  ? "Packages below set the complete booking price. This base price is not offered while a package is required."
                  : "This is the complete price for the standard scope. Packages have their own complete prices; choices and add-ons add to the selected price."}
              </T>
              <Input
                label="Maximum units per booking (1–20)"
                value={String(form.maxQuantity ?? 1)}
                onChangeText={(v) => set("maxQuantity", Number(v))}
                keyboardType="number-pad"
              />
              {(form.maxQuantity || 1) > 1 && (
                <Input
                  label="Unit name"
                  placeholder="e.g. bathroom"
                  maxLength={40}
                  value={form.quantityUnit || ""}
                  onChangeText={(v) => set("quantityUnit", v)}
                />
              )}
            </>
          )}
          <T bold>Duration</T>
          <Row style={{ flexWrap: "wrap" }}>
            {[30, 60, 90, 120, 150, 180, 210, 240].map((minutes) => (
              <Button
                key={minutes}
                label={minutes + " min"}
                secondary={form.duration !== minutes}
                onPress={() => set("duration", minutes)}
              />
            ))}
          </Row>
        </>
      )}
      {step === 0 && (
        <>
          <T bold>Service icon</T>
          <Row style={{ flexWrap: "wrap" }}>
            {[
              ["spark", "Cleaning"],
              ["air", "AC"],
              ["water", "Water"],
              ["bolt", "Electrical"],
              ["roller", "Painting"],
              ["tool", "Repairs"],
              ["grid", "General"],
            ].map(([icon, label]) => (
              <Button
                key={icon}
                label={label + " icon"}
                secondary={form.icon !== icon}
                onPress={() => set("icon", icon)}
              />
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
            onChangeText={(v) => set("excludes", v.split("\n"))}
            multiline
          />
        </>
      )}
      {step === 4 && (
        <>
          <T bold>Service area</T>
          <T color={c.muted}>
            Choose which company PIN codes can book this service. An empty
            selection uses every company PIN code.
          </T>
          {[
            ...new Set([
              ...(state?.settings.pins || []),
              ...(form.coveragePins || []),
            ]),
          ].map((pin) => (
            <Choice
              key={pin}
              label={
                pin +
                (state?.settings.pins.includes(pin)
                  ? ""
                  : " · Outside company coverage")
              }
              checked={form.coveragePins?.includes(pin) ?? false}
              onPress={() =>
                set(
                  "coveragePins",
                  form.coveragePins?.includes(pin)
                    ? form.coveragePins.filter((p) => p !== pin)
                    : [...(form.coveragePins || []), pin],
                )
              }
            />
          ))}
          <T bold>How this service is fulfilled</T>
          <Row style={{ flexWrap: "wrap" }}>
            <Button
              label="Home visit"
              secondary={form.fulfillmentType === "laundry"}
              onPress={() => set("fulfillmentType", "visit")}
            />
            <Button
              label="Laundry pickup and delivery"
              secondary={form.fulfillmentType !== "laundry"}
              onPress={() => set("fulfillmentType", "laundry")}
            />
          </Row>
          {form.fulfillmentType === "laundry" && (
            <T color={c.muted}>
              Collection, processing and delivery must be recorded before
              completion.
            </T>
          )}
          <T bold>Service areas</T>
          <T color={c.muted}>
            {state?.settings.pins.join(", ") ||
              "Configure service PIN codes in company settings."}
          </T>
          <T size={12} color={c.muted}>
            Slots also require a professional who covers this service and PIN
            code.
          </T>
        </>
      )}
      {step === 2 && <ServiceCustomizationEditor value={form} onChange={set} />}
      {step === 3 &&
        (form.bookingMode === "quote" ? (
          <T>Agree any extras as part of the customer’s tailored quote.</T>
        ) : (
          <ServiceAddonsEditor
            form={form}
            onChange={(addons) => set("addons", addons)}
          />
        ))}
      {step === 4 && (
        <>
          <Button
            label={
              advanced
                ? "Hide advanced service options"
                : "Show advanced service options"
            }
            secondary
            onPress={() => setAdvanced(!advanced)}
          />
          {advanced && (
            <View style={{ gap: 16 }}>
              {[
                ["nameTe", "Service name in Telugu"],
                ["descriptionTe", "Description in Telugu"],
              ].map(([key, label]) => (
                <Input
                  key={key}
                  label={label}
                  value={String(form[key as keyof typeof form] || "")}
                  onChangeText={(v) => set(key, v)}
                  multiline={key.startsWith("description")}
                />
              ))}
              <Input
                label="Display order"
                value={String(form.order || 0)}
                onChangeText={(v) => set("order", Number(v))}
                keyboardType="number-pad"
              />
              <Choice
                label="Allow external partner fulfilment for this service"
                checked={form.partnerFulfillmentAllowed !== false}
                onPress={() =>
                  set(
                    "partnerFulfillmentAllowed",
                    form.partnerFulfillmentAllowed === false,
                  )
                }
              />
              <T size={12} color={c.muted}>
                The company must also enable external fallback. In office mode,
                internal workers are considered first.
              </T>
            </View>
          )}
        </>
      )}
      {step === 5 && (
        <>
          <Card style={{ backgroundColor: c.mint }}>
            <ServicePhoto service={{ ...form, id: form.id || "" }} />
            <T bold size={22}>
              {form.name || "Your service"}
            </T>
            <T>{form.headline}</T>
            <T>{form.description}</T>
            <T>
              {form.bookingMode === "quote"
                ? "Request a tailored quote"
                : form.packageRequired
                  ? "Choose a package below"
                  : "Standard · " +
                    money(form.price) +
                    " · " +
                    form.duration +
                    " minutes"}
            </T>
            {!!form.priceUnit && <T>{form.priceUnit}</T>}
            {form.packageRequired && (
              <T color={c.muted}>
                A package is required; the standard price cannot be booked.
              </T>
            )}
            {(form.packages || []).map((p) => (
              <View key={p.id} style={{ gap: 6 }}>
                <T bold>
                  {p.name +
                    (form.bookingMode === "quote"
                      ? ""
                      : " · " + money(p.price))}
                </T>
                <T>{p.description}</T>
                {p.includes.filter(Boolean).map((v, i) => (
                  <T key={i}>{"Included: " + v}</T>
                ))}
                {p.excludes?.filter(Boolean).map((v, i) => (
                  <T key={i}>{"Not included: " + v}</T>
                ))}
              </View>
            ))}
            {form.excludes?.filter(Boolean).map((x, i) => (
              <T key={"ex-" + i}>{"Not included: " + x}</T>
            ))}
            {form.includes.filter(Boolean).map((x, i) => (
              <T key={i}>{"• " + x}</T>
            ))}
            {(form.optionGroups || []).map((group) => (
              <View key={group.id} style={{ gap: 6 }}>
                <T bold>
                  {group.name +
                    (group.required ? " · Required" : " · Optional")}
                </T>
                {group.options.map((option) => (
                  <T key={option.id}>
                    {option.name +
                      (form.bookingMode === "quote"
                        ? ""
                        : option.price
                          ? " · +" + money(option.price)
                          : " · Included")}
                  </T>
                ))}
              </View>
            ))}
            {!!form.addons.length && <T bold>Optional add-ons</T>}
            {form.addons
              .filter((a) => a.enabled !== false)
              .map((addon) => (
                <T key={addon.id}>
                  {addon.name +
                    (form.bookingMode === "quote"
                      ? ""
                      : " · +" + money(addon.price)) +
                    (addon.packageIds
                      ? " · " +
                        addon.packageIds
                          .map((id) =>
                            id
                              ? form.packages?.find((p) => p.id === id)?.name
                              : "Standard service",
                          )
                          .join(", ")
                      : "")}
                </T>
              ))}
            {(form.bookingFields || []).map((field) => (
              <T key={field.id}>
                {field.label +
                  (field.required
                    ? " · Answer required"
                    : " · Optional answer")}
              </T>
            ))}
            <ServiceCare service={cleanService(form)} />
          </Card>
          {state?.mode === "firebase" && service?.sample && (
            <Card style={{ backgroundColor: c.amberbg }}>
              <T bold>Review this sample before publishing</T>
              <T>
                Approve the real price, packages, scope, exclusions and warranty
                terms.
              </T>
              <Choice
                label="I reviewed and approved this service scope and prices"
                checked={!!form.sampleReviewed}
                onPress={() => set("sampleReviewed", !form.sampleReviewed)}
              />
            </Card>
          )}
          <T bold>Publication status</T>
          {(["draft", "active", "paused", "unavailable"] as const).map(
            (status) => (
              <Choice
                key={status}
                label={
                  {
                    draft: "Save as draft",
                    active: "Publish to customers",
                    paused: "Pause new bookings",
                    unavailable: "Mark unavailable",
                  }[status]
                }
                checked={
                  (form.status || (form.active ? "active" : "draft")) === status
                }
                onPress={() => {
                  set("status", status);
                  set("active", status === "active");
                }}
              />
            ),
          )}
          <T size={12} color={c.muted}>
            {form.active
              ? "Saving publishes this scope and price for new bookings."
              : "Saving a draft hides this service from customers."}{" "}
            Existing bookings retain their original scope and price.
          </T>
        </>
      )}
      {!!saveError && (
        <T accessibilityRole="alert" color={c.red}>
          {saveError}
        </T>
      )}
      {step < 5 && (
        <Button
          label={"Next: " + editorSteps[step + 1]}
          onPress={() => setStep(step + 1)}
        />
      )}
      {step > 0 && (
        <Button
          secondary
          label={"Back to " + editorSteps[step - 1]}
          onPress={() => setStep(step - 1)}
        />
      )}
      {step === 5 && (
        <Button
          label="Save service"
          loading={busy}
          onPress={() => void save()}
        />
      )}
      <Button
        label={service ? "Close details" : "Cancel new service"}
        secondary
        disabled={busy}
        onPress={() => setEditing(false)}
      />
    </Card>
  );
}
export function VendorReview({
  professional: p,
}: {
  professional: Professional;
}) {
  const { state, read, request, busy } = useApp(),
    [expanded, setExpanded] = useState(false),
    [verified, setVerified] = useState(false),
    [reason, setReason] = useState(""),
    [message, setMessage] = useState("");
  return (
    <>
      <Button
        label={expanded ? "Close professional review" : "Review professional"}
        secondary
        onPress={() => setExpanded(!expanded)}
      />
      {expanded && (
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
                disabledReason={
                  "Confirm that you checked identity, skills and coverage before approving."
                }
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
                disabledReason={
                  "Describe the required changes in at least 5 characters."
                }
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
          {!!message && <T color={c.red}>{message}</T>}
        </>
      )}
    </>
  );
}
export type SupportDraft = {
  message?: string;
  resolution?: string;
  replyKey?: string;
};
export function SupportReply({
  ticket: t,
  draft,
  onDraftChange,
}: {
  ticket: Ticket;
  draft?: SupportDraft;
  onDraftChange?: (change: SupportDraft) => void;
}) {
  const { request, busy, state, t: translate } = useApp(),
    [localMessage, updateMessage] = useState(draft?.message || ""),
    [localResolution, updateResolution] = useState(draft?.resolution || ""),
    [feedback, setFeedback] = useState(""),
    [localReplyKey, updateReplyKey] = useState(
      () =>
        draft?.replyKey ||
        "reply-" + Date.now() + "-" + Math.random().toString(36).slice(2),
    );
  const message = onDraftChange ? draft?.message || "" : localMessage;
  const resolution = onDraftChange ? draft?.resolution || "" : localResolution;
  const replyKey = onDraftChange
    ? draft?.replyKey || localReplyKey
    : localReplyKey;
  const setMessage = (value: string) => {
    updateMessage(value);
    onDraftChange?.({ message: value, replyKey });
  };
  const setResolution = (value: string) => {
    updateResolution(value);
    onDraftChange?.({ resolution: value });
  };
  const setReplyKey = (value: string) => {
    updateReplyKey(value);
    onDraftChange?.({ replyKey: value });
  };
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
            editable={!busy}
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
            disabledReason={
              "Enter a resolution summary with at least 8 characters."
            }
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
          {!requester && (
            <>
              <T size={12} color={c.muted}>
                Quick reply drafts · review before sending
              </T>
              <Row style={{ flexWrap: "wrap" }}>
                {[
                  [
                    "Acknowledge request",
                    "Thank you for contacting ANVIRA. We are reviewing your request and will update you here.",
                  ],
                  [
                    "Ask for details",
                    "Please share a little more detail about the issue so our team can help you.",
                  ],
                ].map(([label, draft]) => (
                  <Button
                    key={label}
                    label={label}
                    secondary
                    disabledReason={
                      busy
                        ? "Please wait for the current update to finish."
                        : "A reply draft is already entered. Clear it before choosing a template."
                    }
                    disabled={busy || !!message.trim()}
                    onPress={() => setMessage(translate(draft))}
                  />
                ))}
              </Row>
            </>
          )}
          <Input
            editable={!busy}
            label={requester ? "Add a follow-up" : "Reply to customer"}
            value={message}
            onChangeText={setMessage}
            multiline
          />
          <Button
            label={t.status === "resolved" ? "Reopen request" : "Send reply"}
            loading={busy}
            disabledReason={
              "Type a reply with at least 2 characters before sending."
            }
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
  const { section } = useLocalSearchParams<{ section?: string }>();
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
  const staffAccess = (
    <>
      {" "}
      <Card>
        <T bold size={22}>
          Staff access
        </T>
        <T color={c.muted}>
          Admin / Owner manages services, professionals and money approvals.
          Customer Associates manage orders, dispatch, availability and support.
          Internal workers are roster records and do not need accounts.
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
        <T bold>Add Customer Associate staff</T>
        <T color={c.muted}>
          Choose a new staff email and an app password. Share them directly with
          your Customer Associate team member so they can sign in to the staff
          portal. Use an email inbox that this person can access; this creates
          an ANVIRA login, not a new email inbox.
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
        {!!staffError && (
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
        {!!createdEmail && (
          <Card style={{ backgroundColor: c.mint }}>
            <T bold accessibilityLiveRegion="polite">
              Customer Associate account created
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
  return (
    <>
      {section === "staff" && staffAccess}
      {(!section || !["staff", "about", "policies"].includes(section)) && (
        <OfficeDispatchSettings />
      )}
      {section === "about" && <AboutEditor />}
      {section === "policies" && (
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
          <Input
            label="Service PIN codes"
            value={pins}
            onChangeText={setPins}
          />
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
                  internalAssignmentMode:
                    state!.settings.internalAssignmentMode,
                  internalCoveragePauses:
                    state!.settings.internalCoveragePauses,
                  dispatchMode: state!.settings.dispatchMode,
                  externalPartnersEnabled:
                    state!.settings.externalPartnersEnabled,
                  partnerOfferSeconds: state!.settings.partnerOfferSeconds,
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
          {!!settingsError && (
            <T color={c.red} accessibilityRole="alert">
              {settingsError}
            </T>
          )}
          {saved && <Badge label="Settings saved" />}
        </Card>
      )}
    </>
  );
}
export function Promotions() {
  const [editing, setEditing] = useState(false);
  const [now] = useState(() => Date.now());
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
      <Button
        label={editing ? "Close offer editor" : "Create offer"}
        secondary={editing}
        onPress={() => {
          setEditing(!editing);
          setCode("");
        }}
      />
      {editing && (
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
                .then(() => {
                  setCode("");
                  setEditing(false);
                })
                .catch(() => {})
            }
          />
        </Card>
      )}
      {!state?.promotions.length && (
        <T color={c.muted}>
          No offers yet. Create an offer when you are ready to run a promotion.
        </T>
      )}
      {state?.promotions.map((p) => (
        <Card key={p.id}>
          <Row style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
            <T bold>{p.id}</T>
            <Badge
              label={
                !p.active
                  ? "Disabled"
                  : p.expiresAt <= now
                    ? "Expired"
                    : "Active"
              }
            />
          </Row>
          <T>
            {money(p.discountAmount)} off · minimum {money(p.minAmount)}
          </T>
          <T size={12}>{dateLabel(p.expiresAt)}</T>
          <Button
            label={"Edit offer " + p.id}
            secondary
            onPress={() => {
              setCode(p.id);
              setDiscount(String(p.discountAmount));
              setMinimum(String(p.minAmount));
              setUses(String(p.maxUses));
              setExpiry(
                new Date(p.expiresAt + 330 * 60000).toISOString().slice(0, 10),
              );
              setEditing(true);
            }}
          />
          <Button
            label="Disable offer"
            secondary
            loading={busy}
            disabledReason={"This offer is already disabled."}
            disabled={!p.active}
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
  const { section = "requests" } = useLocalSearchParams<{ section?: string }>();
  const payouts = usePagedRecords<AppState["payouts"][number]>("payouts");
  const { state, request, busy } = useApp(),
    [kind, setKind] = useState("refund"),
    [target, setTarget] = useState(""),
    [provider, setProvider] = useState(""),
    [message, setMessage] = useState("");
  return (
    <>
      <Row style={{ flexWrap: "wrap" }}>
        {[
          ["requests", "Payout requests"],
          ["schedule", "Payout schedule"],
          ["reconciliation", "Reconciliation"],
        ].map(([key, label]) => (
          <Button
            key={key}
            label={label}
            secondary={section !== key}
            onPress={() => router.setParams({ section: key })}
          />
        ))}
      </Row>
      {section === "requests" && (
        <>
          <Card style={{ backgroundColor: c.mint }}>
            <T bold size={22}>
              Partner payouts
            </T>
            <T>
              Balances move to a held state when a partner requests withdrawal.
              Only the Owner can approve or reject it.
            </T>
          </Card>

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
          {!payouts.busy && !payouts.error && !payouts.rows.length && (
            <T color={c.muted}>No payout requests to review.</T>
          )}
        </>
      )}
      {section === "schedule" && <PayoutControls />}
      {section === "reconciliation" && (
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
          {!!message && <T>{message}</T>}
        </Card>
      )}
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
        await file.write(await blob.text());
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
      {!!message && <T>{message}</T>}
    </Card>
  );
}
