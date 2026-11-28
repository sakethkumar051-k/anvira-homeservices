import React, { useState } from "react";
import { View, Pressable, Platform } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useApp } from "../lib/context";
import { money, dateLabel, type Promotion } from "../lib/model";
import { T, c, Card, Row, Button, Input, Badge, Icon } from "./ui";
import { Choice } from "./Experience";
import { copyText, openWhatsApp, WEBSITE_URL } from "../lib/share";

type Template = {
  key: string;
  name: string;
  why: string;
  code: string;
  title: string;
  discount: number;
  minimum: number;
  uses: number;
  days: number;
};

export const offerTemplates: Template[] = [
  {
    key: "welcome",
    name: "Welcome offer",
    why: "Turn first-time visitors into customers.",
    code: "WELCOME100",
    title: "₹100 off your booking",
    discount: 100,
    minimum: 499,
    uses: 500,
    days: 60,
  },
  {
    key: "weekend",
    name: "Weekend saver",
    why: "Fill quieter weekday and weekend slots.",
    code: "WEEKEND150",
    title: "Weekend saver: ₹150 off",
    discount: 150,
    minimum: 999,
    uses: 200,
    days: 30,
  },
  {
    key: "festive",
    name: "Festive deep clean",
    why: "Ride the pre-festival cleaning rush.",
    code: "FESTIVE250",
    title: "Festive special: ₹250 off",
    discount: 250,
    minimum: 1999,
    uses: 300,
    days: 21,
  },
  {
    key: "comeback",
    name: "Win back",
    why: "Bring past customers back for a repeat visit.",
    code: "COMEBACK200",
    title: "We miss you: ₹200 off",
    discount: 200,
    minimum: 1499,
    uses: 100,
    days: 30,
  },
];

const inDays = (days: number) =>
  new Date(Date.now() + 330 * 60000 + days * 86400000)
    .toISOString()
    .slice(0, 10);

export function offerMessage(p: Pick<Promotion, "id" | "discountAmount" | "minAmount" | "expiresAt" | "title">) {
  return (
    (p.title ? p.title + "\n" : "") +
    `Use code ${p.id} to get ${money(p.discountAmount)} off ANVIRA home services on bookings of ${money(p.minAmount)} or more. ` +
    `Valid until ${new Date(p.expiresAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" })}.\n` +
    `Book trusted cleaning, car care, AC, RO, plumbing and electrical visits: ${WEBSITE_URL}`
  );
}

/** How the offer appears to customers in the app. */
export function OfferTicket({
  code,
  title,
  discount,
  minimum,
  expiresAt,
  action,
}: {
  code: string;
  title?: string;
  discount: number;
  minimum: number;
  expiresAt: number;
  action?: React.ReactNode;
}) {
  const { t, lang } = useApp();
  return (
    <View
      style={{
        flexDirection: "row",
        borderRadius: 18,
        overflow: "hidden",
        backgroundColor: c.forest,
        minHeight: 104,
      }}
    >
      <View
        style={{
          width: 96,
          backgroundColor: c.gold,
          alignItems: "center",
          justifyContent: "center",
          padding: 10,
        }}
      >
        <T bold size={22} color={c.forest} style={{ letterSpacing: -0.5 }}>
          {money(discount)}
        </T>
        <T bold size={11} color={c.forest}>
          OFF
        </T>
      </View>
      <View style={{ flex: 1, padding: 14, gap: 4, justifyContent: "center" }}>
        <T bold size={15} color={c.white} numberOfLines={2}>
          {title || t("Save on your next booking")}
        </T>
        <T size={11} color="#B7CEC4">
          {t("Minimum order") +
            " " +
            money(minimum) +
            " · " +
            t("Valid until") +
            " " +
            new Date(expiresAt).toLocaleDateString(
              lang === "te" ? "te-IN" : "en-IN",
              { timeZone: "Asia/Kolkata", day: "numeric", month: "short" },
            )}
        </T>
        <Row style={{ justifyContent: "space-between", marginTop: 4 }}>
          <View
            style={{
              borderWidth: 1,
              borderStyle: "dashed",
              borderColor: c.gold,
              borderRadius: 8,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <T bold size={12} color={c.gold} style={{ letterSpacing: 1.5 }}>
              {code}
            </T>
          </View>
          {action}
        </Row>
      </View>
    </View>
  );
}

export function Promotions() {
  const { template: requested } = useLocalSearchParams<{ template?: string }>();
  const [editing, setEditing] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [offerError, setOfferError] = useState("");
  const [notice, setNotice] = useState("");
  const [now] = useState(() => Date.now());
  const { state, request, busy, t } = useApp(),
    [code, setCode] = useState(""),
    [title, setTitle] = useState(""),
    [featured, setFeatured] = useState(true),
    [discount, setDiscount] = useState("100"),
    [minimum, setMinimum] = useState("500"),
    [uses, setUses] = useState("100"),
    [expiry, setExpiry] = useState(() => inDays(30));
  const [appliedTemplate, setAppliedTemplate] = useState("");
  function applyTemplate(x: Template) {
    setEditingId("");
    setOfferError("");
    setCode(
      state?.promotions.some((p) => p.id === x.code) ? "" : x.code,
    );
    setTitle(x.title);
    setDiscount(String(x.discount));
    setMinimum(String(x.minimum));
    setUses(String(x.uses));
    setExpiry(inDays(x.days));
    setFeatured(true);
    setEditing(true);
    setAppliedTemplate(x.key);
  }
  // Apply a template named in the link once, e.g. from the Growth page.
  const [linkedTemplate, setLinkedTemplate] = useState("");
  if (requested && requested !== linkedTemplate) {
    setLinkedTemplate(requested);
    const match = offerTemplates.find((x) => x.key === requested);
    if (match) applyTemplate(match);
  }
  const offers = [...(state?.promotions || [])].sort(
    (a, b) =>
      Number(b.active && b.expiresAt > now) -
        Number(a.active && a.expiresAt > now) || b.expiresAt - a.expiresAt,
  );
  const live = offers.filter(
    (p) => p.active && p.expiresAt > now && (p.uses || 0) < p.maxUses,
  );
  const redemptions = offers.reduce((sum, p) => sum + (p.uses || 0), 0);
  const given = offers.reduce(
    (sum, p) => sum + (p.uses || 0) * p.discountAmount,
    0,
  );
  const previewExpiry = Date.parse(expiry + "T18:29:59Z");
  async function share(p: Promotion, via: "copy" | "whatsapp") {
    const message = offerMessage(p);
    if (via === "whatsapp") {
      if (!(await openWhatsApp(message))) setNotice(t("Could not open WhatsApp."));
      return;
    }
    setNotice(
      t(
        (await copyText(message))
          ? "Offer message copied. Paste it into WhatsApp, Instagram or SMS."
          : "Copy is blocked in this browser. Select the message and copy it manually.",
      ),
    );
  }
  return (
    <>
      <Row style={{ flexWrap: "wrap", alignItems: "stretch" }}>
        {[
          ["Live offers", String(live.length), "spark"],
          ["Times redeemed", String(redemptions), "check"],
          ["Discounts given", money(given), "gift"],
        ].map(([label, value, icon]) => (
          <Card key={label} style={{ flexGrow: 1, flexBasis: 200 }}>
            <Row style={{ justifyContent: "space-between" }}>
              <T size={12} color={c.muted}>
                {label}
              </T>
              <Icon name={icon} size={18} />
            </Row>
            <T bold size={26}>
              {value}
            </T>
          </Card>
        ))}
      </Row>
      <Card style={{ backgroundColor: c.mint, borderColor: c.mint }}>
        <T bold size={18}>
          Start from a proven offer
        </T>
        <T size={12} color={c.muted}>
          Pick a template to fill in the details. Nothing is published until you
          save it.
        </T>
        <Row style={{ flexWrap: "wrap", alignItems: "stretch" }}>
          {offerTemplates.map((x) => (
            <Pressable
              key={x.key}
              accessibilityRole="button"
              accessibilityLabel={t("Use template") + ": " + t(x.name)}
              onPress={() => applyTemplate(x)}
              style={({ pressed }) => ({
                flexGrow: 1,
                flexBasis: 220,
                backgroundColor: c.white,
                borderRadius: 16,
                padding: 14,
                gap: 6,
                borderWidth: 1,
                borderColor: appliedTemplate === x.key && editing ? c.green : c.line,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Row style={{ justifyContent: "space-between" }}>
                <T bold size={14}>
                  {x.name}
                </T>
                <T bold size={13} color={c.green}>
                  {money(x.discount) + " " + t("off")}
                </T>
              </Row>
              <T size={12} color={c.muted}>
                {x.why}
              </T>
              <T size={11} color={c.muted}>
                {t("Minimum") + " " + money(x.minimum) + " · " + x.days + " " + t("days")}
              </T>
            </Pressable>
          ))}
        </Row>
      </Card>
      <Button
        label={editing ? "Close offer editor" : "Create offer"}
        secondary={editing}
        onPress={() => {
          setEditing(!editing);
          setEditingId("");
          setOfferError("");
          setCode("");
          setTitle("");
          setFeatured(true);
          setAppliedTemplate("");
        }}
      />
      {editing && (
        <Card>
          <T bold size={22}>
            Create or update an offer
          </T>
          <View style={{ flexDirection: Platform.OS === "web" ? "row" : "column", gap: 24, flexWrap: "wrap" }}>
            <View style={{ flex: 1, minWidth: 280, gap: 12 }}>
              <Input
                label="Offer code"
                value={code}
                onChangeText={(value) => setCode(value.toUpperCase())}
                autoCapitalize="characters"
                help="3–20 capital letters or numbers, for example WELCOME100."
              />
              <Input
                label="Offer headline (shown to customers)"
                value={title}
                onChangeText={setTitle}
                maxLength={60}
                placeholder="₹100 off your booking"
              />
              <Row style={{ flexWrap: "wrap", alignItems: "flex-start" }}>
                <View style={{ flex: 1, minWidth: 140 }}>
                  <Input
                    label="Discount (₹)"
                    value={discount}
                    onChangeText={setDiscount}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={{ flex: 1, minWidth: 140 }}>
                  <Input
                    label="Minimum service value (₹)"
                    value={minimum}
                    onChangeText={setMinimum}
                    keyboardType="number-pad"
                  />
                </View>
              </Row>
              <Row style={{ flexWrap: "wrap", alignItems: "flex-start" }}>
                <View style={{ flex: 1, minWidth: 140 }}>
                  <Input
                    label="Maximum uses"
                    value={uses}
                    onChangeText={setUses}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={{ flex: 1, minWidth: 140 }}>
                  <Input
                    label="Valid through (YYYY-MM-DD)"
                    value={expiry}
                    onChangeText={setExpiry}
                  />
                </View>
              </Row>
              <Choice
                label="Show this offer in the customer app"
                checked={featured}
                onPress={() => setFeatured(!featured)}
              />
              <T size={11} color={c.muted}>
                {featured
                  ? "Customers see it on the home screen and can apply it at checkout with one tap."
                  : "Private code: it works at checkout but is only known to people you give it to."}
              </T>
            </View>
            <View style={{ flex: 1, minWidth: 280, gap: 10 }}>
              <T bold size={12} color={c.muted}>
                CUSTOMER PREVIEW
              </T>
              <OfferTicket
                code={code.trim() || "CODE"}
                title={title.trim()}
                discount={Number(discount) || 0}
                minimum={Number(minimum) || 0}
                expiresAt={Number.isFinite(previewExpiry) ? previewExpiry : now}
              />
              {Number(discount) >= Number(minimum) && Number(minimum) > 0 && (
                <T size={12} color={c.amber}>
                  The discount is as large as the minimum order. Check the
                  numbers before saving.
                </T>
              )}
            </View>
          </View>
          <Button
            label="Save offer"
            loading={busy}
            onPress={() => {
              const id = code.trim().toUpperCase();
              if (
                id !== editingId &&
                state?.promotions.some((offer) => offer.id === id)
              ) {
                setOfferError(
                  "An offer with this code already exists. Use Edit on that offer instead.",
                );
                return;
              }
              if (!/^[A-Z0-9]{3,20}$/.test(id)) {
                setOfferError(
                  "Use 3–20 capital letters or numbers for the offer code.",
                );
                return;
              }
              setOfferError("");
              void request(
                "/promotions",
                {
                  id,
                  discountAmount: Number(discount),
                  minAmount: Number(minimum),
                  maxUses: Number(uses),
                  expiresAt: Date.parse(expiry + "T18:29:59Z"),
                  active: true,
                  featured,
                  ...(title.trim() ? { title: title.trim() } : {}),
                },
                "PUT",
              )
                .then(() => {
                  setCode("");
                  setTitle("");
                  setEditingId("");
                  setEditing(false);
                  setNotice(
                    featured
                      ? t("Offer saved. Customers can see it in the app now.")
                      : t("Offer saved as a private code."),
                  );
                })
                .catch((e) => setOfferError((e as Error).message));
            }}
          />
          {!!offerError && (
            <T color={c.red} accessibilityRole="alert">
              {offerError}
            </T>
          )}
        </Card>
      )}
      {!!notice && (
        <T color={c.green} accessibilityLiveRegion="polite">
          {notice}
        </T>
      )}
      {!offers.length && (
        <T color={c.muted}>
          No offers yet. Create an offer when you are ready to run a promotion.
        </T>
      )}
      <Row style={{ flexWrap: "wrap", alignItems: "stretch" }}>
        {offers.map((p) => {
          const exhausted = (p.uses || 0) >= p.maxUses;
          const status = !p.active
            ? "Disabled"
            : p.expiresAt <= now
              ? "Expired"
              : exhausted
                ? "Fully used"
                : "Active";
          const daysLeft = Math.max(
            0,
            Math.ceil((p.expiresAt - now) / 86400000),
          );
          const used = Math.min(1, (p.uses || 0) / Math.max(1, p.maxUses));
          return (
            <Card key={p.id} style={{ flexGrow: 1, flexBasis: 340 }}>
              <Row style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                <T bold size={18} style={{ letterSpacing: 1 }}>
                  {p.id}
                </T>
                <Row style={{ gap: 6 }}>
                  <Badge
                    label={p.featured ? "Shown in app" : "Private code"}
                    tone={p.featured ? "green" : "amber"}
                  />
                  <Badge
                    label={status}
                    tone={status === "Active" ? "green" : "red"}
                  />
                </Row>
              </Row>
              {!!p.title && <T bold>{p.title}</T>}
              <T>
                {money(p.discountAmount)} off · minimum {money(p.minAmount)}
              </T>
              <T size={12} color={c.muted}>
                {t("Valid until") +
                  " " +
                  dateLabel(p.expiresAt) +
                  (status === "Active"
                    ? " · " + daysLeft + " " + t(daysLeft === 1 ? "day left" : "days left")
                    : "")}
              </T>
              <View style={{ gap: 6 }}>
                <Row style={{ justifyContent: "space-between" }}>
                  <T size={12} color={c.muted}>
                    {(p.uses || 0) + " / " + p.maxUses + " " + t("redeemed")}
                  </T>
                  <T size={12} bold color={c.green}>
                    {money((p.uses || 0) * p.discountAmount) + " " + t("given")}
                  </T>
                </Row>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: c.soft }}>
                  <View
                    style={{
                      height: 8,
                      borderRadius: 4,
                      width: `${Math.max(2, used * 100)}%`,
                      backgroundColor: c.green,
                    }}
                  />
                </View>
              </View>
              <Row style={{ flexWrap: "wrap" }}>
                <View style={{ flexGrow: 1 }}>
                  <Button
                    label={"Edit offer " + p.id}
                    secondary
                    onPress={() => {
                      setEditingId(p.id);
                      setOfferError("");
                      setCode(p.id);
                      setTitle(p.title || "");
                      setFeatured(!!p.featured);
                      setDiscount(String(p.discountAmount));
                      setMinimum(String(p.minAmount));
                      setUses(String(p.maxUses));
                      setExpiry(
                        new Date(p.expiresAt + 330 * 60000)
                          .toISOString()
                          .slice(0, 10),
                      );
                      setEditing(true);
                    }}
                  />
                </View>
                {status === "Active" && (
                  <>
                    <View style={{ flexGrow: 1 }}>
                      <Button
                        label="Copy share message"
                        secondary
                        onPress={() => void share(p, "copy")}
                      />
                    </View>
                    <View style={{ flexGrow: 1 }}>
                      <Button
                        label="Share on WhatsApp"
                        secondary
                        onPress={() => void share(p, "whatsapp")}
                      />
                    </View>
                  </>
                )}
              </Row>
              <Button
                label="Disable offer"
                secondary
                loading={busy}
                disabledReason={"This offer is already disabled."}
                disabled={!p.active}
                onPress={() =>
                  void request(
                    "/promotions",
                    { ...p, active: false },
                    "PUT",
                  ).catch(() => {})
                }
              />
            </Card>
          );
        })}
      </Row>
    </>
  );
}
