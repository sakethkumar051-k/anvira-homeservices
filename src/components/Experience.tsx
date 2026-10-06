import { verificationEmail, prepareAccountDeletion } from "../lib/auth";
import { ProfessionalProfileEditor } from "./ProfessionalPhoto";
import { useBookingAlerts } from "./BookingAlerts";
import React, { useEffect, useState } from "react";
import { View, Pressable, Platform, Linking } from "react-native";
import { router, useIsFocused } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as DocumentPicker from "expo-document-picker";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { useApp } from "../lib/context";
import { AppState, Booking, money, dateLabel, statusLabel } from "../lib/model";
import { T, c, Card, Row, Button, Input, Badge, Empty, styles } from "./ui";
import { Shell } from "./Shell";
import { usePagedRecords, PageControls } from "./PagedRecords";
const go = (path: string) => router.push(path as never);
export function Choice({
  label,
  checked,
  onPress,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={onPress}
      style={{
        minHeight: 48,
        padding: 12,
        borderRadius: 12,
        backgroundColor: checked ? c.mint : c.ivory,
        borderWidth: 1,
        borderColor: checked ? c.green : c.line,
      }}
    >
      <T bold color={checked ? c.green : c.ink}>
        {checked ? "✓ " : ""}
        {label}
      </T>
    </Pressable>
  );
}
export function PaymentButton({ booking }: { booking: Booking }) {
  const focused = useIsFocused();
  const { state, request, busy, refresh } = useApp(),
    [message, setMessage] = useState("");
  async function pay() {
    let popup: Window | null = null;
    try {
      setMessage("");
      if (state?.mode === "demo") {
        await request("/bookings/" + booking.id + "/action", { action: "pay" });
        return;
      }
      if (Platform.OS === "web") {
        popup = window.open(
          "about:blank",
          "anvira-checkout",
          "width=480,height=760",
        );
        if (!popup) throw new Error("Allow pop-ups to open secure checkout.");
      }
      const result = await request<{ checkoutUrl: string }>(
        "/bookings/" + booking.id + "/payment/order",
        {},
      );
      if (popup) {
        popup.location.replace(result.checkoutUrl);
        setMessage(
          "Secure checkout opened. Return here to check your booking.",
        );
      } else {
        await WebBrowser.openBrowserAsync(result.checkoutUrl);
        await refresh();
      }
    } catch (e) {
      popup?.close();
      setMessage((e as Error).message);
    }
  }
  useEffect(() => {
    if (Platform.OS !== "web" || !focused) return;
    const listener = (event: MessageEvent) => {
      if (
        event.origin !==
        new URL(process.env.EXPO_PUBLIC_API_URL || window.location.origin)
          .origin
      )
        return;
      if (
        event.data?.type === "ANVIRA_PAYMENT" &&
        event.data?.bookingId === booking.id
      )
        void refresh();
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [booking.id, refresh, focused]);
  return (
    <>
      <Button
        label={state?.mode === "demo" ? "Simulate payment" : "Pay securely"}
        loading={busy}
        onPress={() => void pay()}
      />
      {message ? <T color={c.muted}>{message}</T> : null}
      {state?.mode !== "demo" && (
        <Button
          label="Check payment status"
          secondary
          onPress={() => void refresh()}
        />
      )}
    </>
  );
}
export function Addresses() {
  const { state, request, busy } = useApp(),
    [id, setId] = useState(""),
    [label, setLabel] = useState("Home"),
    [line, setLine] = useState(""),
    [pin, setPin] = useState("509216"),
    [remove, setRemove] = useState("");
  async function save() {
    try {
      await request(
        "/addresses" + (id ? "/" + id : ""),
        { label, line, pin },
        id ? "PATCH" : "POST",
      );
      setId("");
      setLine("");
    } catch {}
  }
  return (
    <Shell title="Saved addresses" back>
      {state?.user.role !== "customer" ? (
        <Empty
          title="Customer access required"
          detail="Addresses are managed in your customer account."
        />
      ) : (
        <>
          <Card>
            <T bold size={20}>
              {id ? "Edit address" : "Add an address"}
            </T>
            <Input
              label="Address label"
              value={label}
              onChangeText={setLabel}
            />
            <Input
              label="Your address"
              value={line}
              onChangeText={setLine}
              multiline
            />
            <Input
              label="PIN code"
              value={pin}
              onChangeText={setPin}
              keyboardType="number-pad"
              maxLength={6}
            />
            <Button
              label="Save address"
              loading={busy}
              onPress={() => void save()}
            />
            {id && (
              <Button
                label="Cancel edit"
                secondary
                onPress={() => {
                  setId("");
                  setLine("");
                }}
              />
            )}
          </Card>
          {state?.addresses.map((a) => (
            <Card key={a.id}>
              <T bold>{a.label}</T>
              <T>{a.line}</T>
              <T color={c.muted}>{a.pin}</T>
              <Row>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Edit address"
                    secondary
                    onPress={() => {
                      setId(a.id);
                      setLabel(a.label);
                      setLine(a.line);
                      setPin(a.pin);
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Remove address"
                    secondary
                    onPress={() => setRemove(a.id)}
                  />
                </View>
              </Row>
              {remove === a.id && (
                <>
                  <T>Remove this saved address?</T>
                  <Button
                    label="Confirm removal"
                    danger
                    loading={busy}
                    onPress={() =>
                      void request("/addresses/" + a.id, undefined, "DELETE")
                        .then(() => setRemove(""))
                        .catch(() => {})
                    }
                  />
                </>
              )}
            </Card>
          ))}
        </>
      )}
    </Shell>
  );
}
export function AccountSettings() {
  const { state, request, busy, lang, logout, completeLogin } = useApp(),
    [name, setName] = useState(state?.user.name || ""),
    [phone, setPhone] = useState(
      (state?.user.phone || "").replace(/^\+91/, ""),
    ),
    [remove, setRemove] = useState(false),
    [confirmation, setConfirmation] = useState(""),
    [saved, setSaved] = useState(false),
    [verificationMessage, setVerificationMessage] = useState(""),
    [verificationAt, setVerificationAt] = useState(0);
  return (
    <Shell title="Account settings" back>
      {state?.mode === "firebase" &&
        state.user.signInProvider === "password" && (
          <Card>
            <T bold>
              {state.user.emailVerified
                ? "Email verified"
                : "Verify your email"}
            </T>
            <T>{state.user.email || ""}</T>
            {!state.user.emailVerified && (
              <>
                <T color={c.muted}>
                  Open the link in your verification email, then sign in again
                  to update your account.
                </T>
                <Button
                  label="Send verification email"
                  secondary
                  onPress={() => {
                    if (Date.now() - verificationAt < 60000) {
                      setVerificationMessage(
                        "Please wait a minute before sending another link.",
                      );
                      return;
                    }
                    setVerificationAt(Date.now());
                    void verificationEmail()
                      .then(() =>
                        setVerificationMessage(
                          "Verification email sent. Check your inbox and spam folder.",
                        ),
                      )
                      .catch((e) => setVerificationMessage(e.message));
                  }}
                />
              </>
            )}
            {!!verificationMessage && (
              <T accessibilityRole="alert">{verificationMessage}</T>
            )}
          </Card>
        )}
      <Card>
        <Input label="Your name" value={name} onChangeText={setName} />
        <Input
          label="Contact mobile number (optional)"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          maxLength={10}
          placeholder="10-digit Indian mobile number"
        />
        <T size={12} color={c.muted}>
          For service coordination. This number is not verified and is not used
          to sign in.
        </T>
        <Button
          label="Save profile"
          loading={busy}
          onPress={() =>
            void request("/profile", { name, phone, language: lang }, "PATCH")
              .then(() => setSaved(true))
              .catch(() => {})
          }
        />
        {saved && <Badge label="Profile saved" />}
      </Card>
      <Card>
        <T bold>Privacy & booking policy</T>
        {state?.settings.termsUrl && (
          <Button
            label="Terms of service"
            secondary
            onPress={() => void Linking.openURL(state.settings.termsUrl)}
          />
        )}{" "}
        {state?.settings.privacyUrl && (
          <Button
            label="Privacy policy"
            secondary
            onPress={() => void Linking.openURL(state.settings.privacyUrl)}
          />
        )}
        <T size={12} color={c.muted}>
          You can request account deletion after active bookings, refunds and
          partner balances are settled. Financial records are retained as
          required by the published policy.
        </T>
      </Card>
      {["customer", "professional"].includes(state?.user.role || "") && (
        <Card>
          <T bold>Delete account</T>
          <T color={c.muted}>
            Your personal profile and saved addresses will be removed. This
            action cannot be undone.
          </T>
          <Button
            label="Delete my account"
            secondary
            onPress={() => setRemove(true)}
          />
          {remove && (
            <>
              <Input
                label="Type DELETE to confirm"
                value={confirmation}
                onChangeText={setConfirmation}
                autoCapitalize="characters"
              />
              <Button
                label="Confirm account deletion"
                danger
                disabled={confirmation !== "DELETE"}
                loading={busy}
                onPress={() =>
                  void (async () => {
                    const freshToken = await prepareAccountDeletion();
                    if (freshToken) await completeLogin(freshToken);
                    return request("/account", undefined, "DELETE");
                  })()
                    .then(() => {
                      logout();
                      router.replace("/");
                    })
                    .catch(() => {})
                }
              />
            </>
          )}
        </Card>
      )}
    </Shell>
  );
}
export function PartnerSetup() {
  const { state, request, upload, busy } = useApp(),
    pro = state?.professionals.find((p) => p.id === state.user.id);
  const [name, setName] = useState(pro?.name || state?.user.name || ""),
    [skills, setSkills] = useState(pro?.skills || []),
    [pins, setPins] = useState(
      pro?.pins?.join(",") || state?.settings.pins.join(",") || "509216",
    ),
    [years, setYears] = useState(String(pro?.experienceYears || 0)),
    [bio, setBio] = useState(pro?.bio || ""),
    [terms, setTerms] = useState(false),
    [days, setDays] = useState(pro?.schedule?.days || [1, 2, 3, 4, 5, 6]),
    [hours, setHours] = useState(pro?.schedule?.hours || [9, 12, 15, 18]),
    [blocked, setBlocked] = useState(
      pro?.schedule?.blockedDates.join(",") || "",
    ),
    [fileMessage, setFileMessage] = useState("");
  async function submit() {
    try {
      await request("/professional/onboard", {
        name,
        skills,
        pins: pins.split(",").map((x) => x.trim()),
        experienceYears: Number(years),
        bio,
        termsAccepted: terms,
      });
    } catch {}
  }
  async function document(kind: string) {
    try {
      setFileMessage("");
      const picked = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/jpeg", "image/png"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled) return;
      const asset = picked.assets[0];
      if ((asset.size || 0) > 10 * 1024 * 1024)
        throw new Error("The file must be 10 MB or smaller.");
      const form = new FormData();
      form.append("kind", kind);
      if (Platform.OS === "web") {
        const blob = asset.file || (await (await fetch(asset.uri)).blob());
        form.append("file", blob, asset.name);
      } else
        form.append("file", {
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || "application/octet-stream",
        } as unknown as Blob);
      await upload("/professional/documents", form);
      setFileMessage("Document uploaded for review.");
    } catch (e) {
      setFileMessage((e as Error).message);
    }
  }
  if (!["customer", "professional"].includes(state?.user.role || ""))
    return (
      <Shell title="Professional profile" back>
        <Empty
          title="Access restricted"
          detail="Use a customer or professional account to apply."
        />
      </Shell>
    );
  return (
    <Shell title="Professional profile & schedule" back>
      <Card style={{ backgroundColor: c.forest }}>
        <T size={25} bold color={c.white}>
          Bring your craft home.
        </T>
        <T color={c.gold}>Join ANVIRA’s professional network.</T>
        <Badge
          label={
            pro?.approved
              ? "Approved"
              : statusLabel(pro?.status || "New application")
          }
        />
      </Card>
      {pro && state?.user.role === "professional" && (
        <ProfessionalProfileEditor professional={pro} />
      )}
      {pro?.reviewReason && (
        <Card style={{ backgroundColor: c.amberbg }}>
          <T bold>Changes requested</T>
          <T>{pro.reviewReason}</T>
        </Card>
      )}
      {!pro?.approved ? (
        <>
          <Card>
            <Input label="Full name" value={name} onChangeText={setName} />
            <Input
              label="Experience in years"
              value={years}
              onChangeText={setYears}
              keyboardType="number-pad"
            />
            <Input
              label="About your work"
              value={bio}
              onChangeText={setBio}
              multiline
            />
            <T bold>Service skills</T>
            {state?.services.map((s) => (
              <Choice
                key={s.id}
                label={s.name}
                checked={skills.includes(s.id)}
                onPress={() =>
                  setSkills(
                    skills.includes(s.id)
                      ? skills.filter((x) => x !== s.id)
                      : [...skills, s.id],
                  )
                }
              />
            ))}
            <Input
              label="Service PIN codes, separated by commas"
              value={pins}
              onChangeText={setPins}
            />
            <Choice
              label="I agree to ANVIRA professional terms and document verification"
              checked={terms}
              onPress={() => setTerms(!terms)}
            />
            {state?.settings.termsUrl && (
              <Button
                label="Terms of service"
                secondary
                onPress={() => void Linking.openURL(state.settings.termsUrl)}
              />
            )}
            <Button
              label="Submit professional profile"
              disabled={!terms || !skills.length}
              loading={busy}
              onPress={() => void submit()}
            />
          </Card>
          {pro && (
            <Card>
              <T bold>Verification documents</T>
              <T size={12} color={c.muted}>
                Upload a government identity document and a skill certificate.
                PDF, JPG or PNG; up to 10 MB each. Documents are visible only to
                you and the Owner.
              </T>
              <Button
                label="Upload identity document"
                secondary
                disabled={busy}
                onPress={() => void document("identity")}
              />
              <Button
                label="Upload skill certificate"
                secondary
                disabled={busy}
                onPress={() => void document("skill_certificate")}
              />
              {pro.documents?.map((d) => (
                <Badge
                  key={d.id}
                  label={
                    d.kind === "identity"
                      ? "Identity document received"
                      : "Skill certificate received"
                  }
                />
              ))}
              {fileMessage && <T>{fileMessage}</T>}
            </Card>
          )}
        </>
      ) : (
        <Card>
          <T bold>{pro.name}</T>
          <T>{pro.bio}</T>
          <T color={c.muted}>
            {pro.skills
              .map((id) => state?.services.find((s) => s.id === id)?.name || id)
              .join(" · ")}
          </T>
          <T>{pro.pins?.join(" · ")}</T>
        </Card>
      )}
      {pro && (
        <Card>
          <T bold size={20}>
            Your working schedule
          </T>
          <T color={c.muted} size={12}>
            Indian Standard Time. Existing jobs remain assigned when you change
            your schedule.
          </T>
          <View style={styles.grid}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
              <Choice
                key={d}
                label={d}
                checked={days.includes(i)}
                onPress={() =>
                  setDays(
                    days.includes(i)
                      ? days.filter((x) => x !== i)
                      : [...days, i],
                  )
                }
              />
            ))}
          </View>
          <View style={styles.grid}>
            {[9, 12, 15, 18].map((h) => (
              <Choice
                key={h}
                label={`${h}:00`}
                checked={hours.includes(h)}
                onPress={() =>
                  setHours(
                    hours.includes(h)
                      ? hours.filter((x) => x !== h)
                      : [...hours, h],
                  )
                }
              />
            ))}
          </View>
          <Input
            label="Days off (YYYY-MM-DD, separated by commas)"
            value={blocked}
            onChangeText={setBlocked}
          />
          <Button
            label="Save schedule"
            loading={busy}
            onPress={() =>
              void request(
                "/professional/schedule",
                {
                  days,
                  hours,
                  blockedDates: blocked
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean),
                },
                "PUT",
              ).catch(() => {})
            }
          />
        </Card>
      )}
    </Shell>
  );
}
export function PartnerWallet() {
  const ledger = usePagedRecords<AppState["ledger"][number]>("ledger"),
    payouts = usePagedRecords<AppState["payouts"][number]>("payouts");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const { state, request, read, busy } = useApp(),
    pro = state?.professionals.find((p) => p.id === state.user.id),
    [name, setName] = useState(pro?.name || ""),
    [account, setAccount] = useState(""),
    [ifsc, setIfsc] = useState(""),
    [confirm, setConfirm] = useState(""),
    [amount, setAmount] = useState(""),
    [message, setMessage] = useState(""),
    [verificationConsent, setVerificationConsent] = useState(false),
    [policy, setPolicy] = useState<{
      frequency: string;
      nextRunAt: number | null;
      minimum: number;
      reserve: number;
      maximum: number;
      approvalRequired: boolean;
    } | null>(null),
    [key, setKey] = useState(
      () => `payout-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
  useEffect(() => {
    if (pro?.type === "Partner")
      void read<typeof policy>("/professional/payout-schedule")
        .then(setPolicy)
        .catch(() => {});
  }, [read, pro?.type]);
  async function bank() {
    try {
      if (account !== confirm)
        throw new Error("Bank account numbers do not match.");
      await request("/professional/bank", {
        name,
        accountNumber: account,
        ifsc: ifsc.toUpperCase(),
      });
      setAccount("");
      setConfirm("");
      setVerificationConsent(false);
      setMessage(
        "Payout account saved. Verify it before requesting a transfer.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <>
      <Card style={{ backgroundColor: c.forest }}>
        <T color={c.gold}>Available partner balance</T>
        <T color={c.white} bold size={36}>
          {money(state?.wallet.available || 0)}
        </T>
        <Row>
          <T color={c.white}>Held: {money(state?.wallet.held || 0)}</T>
          <T color={c.white}>Paid: {money(state?.wallet.paid || 0)}</T>
        </Row>
      </Card>
      {policy && (
        <Card style={{ backgroundColor: c.mint }}>
          <T bold>Your payout plan</T>
          <T>
            {policy.frequency === "paused"
              ? "Automatic payouts are paused. You can request a withdrawal from your verified account."
              : policy.frequency === "daily"
                ? "Your eligible earnings are checked daily."
                : "Your eligible earnings are checked weekly."}
          </T>
          {policy.nextRunAt && <T>Next cycle: {dateLabel(policy.nextRunAt)}</T>}
          <T size={12}>
            Minimum {money(policy.minimum)} · Wallet reserve{" "}
            {money(policy.reserve)} · Maximum per cycle {money(policy.maximum)}
          </T>
          <Badge
            label={
              policy.approvalRequired
                ? "Owner approval required"
                : "Automatic transfers after verification"
            }
          />
        </Card>
      )}
      {pro?.type === "Partner" && state?.features?.payouts ? (
        <>
          <Card>
            <T bold>Payout account</T>
            {pro.bankLast4 && (
              <Badge label={"Bank account ending " + pro.bankLast4} />
            )}
            {pro.bankVerification && (
              <Badge
                label={
                  pro.bankVerification === "verified"
                    ? "Bank account verified"
                    : pro.bankVerification === "unverified"
                      ? "Bank verification required"
                      : pro.bankVerification === "needs_review"
                        ? "Bank holder name awaiting Owner review"
                        : pro.bankVerification === "unknown"
                          ? "Provider result needs reconciliation"
                          : pro.bankVerification === "failed"
                            ? "Bank verification failed"
                            : "Bank verification in progress"
                }
                tone={pro.bankVerification === "verified" ? "green" : "amber"}
              />
            )}
            {!!pro.bankEligibleAt && pro.bankEligibleAt > now && (
              <T size={12}>
                Transfers unlock after the bank change cooling period:{" "}
                {dateLabel(pro.bankEligibleAt)}
              </T>
            )}
            <Input
              label="Account holder name"
              value={name}
              onChangeText={setName}
            />
            <Input
              label="Bank account number"
              value={account}
              onChangeText={setAccount}
              keyboardType="number-pad"
              secureTextEntry
              editable={!busy}
            />
            <Input
              label="Confirm account number"
              value={confirm}
              onChangeText={setConfirm}
              keyboardType="number-pad"
              secureTextEntry
              editable={!busy}
            />
            <Input
              label="IFSC"
              value={ifsc}
              onChangeText={setIfsc}
              autoCapitalize="characters"
            />
            <T size={12} color={c.muted}>
              Sensitive changes require a sign-in within the last five minutes.
            </T>
            <Button
              label="Save payout account"
              loading={busy}
              disabled={!pro.approved}
              onPress={() => void bank()}
            />
            {pro.bankLast4 && pro.bankVerification !== "verified" && (
              <>
                <T size={12}>
                  ANVIRA verifies the account with a ₹1 bank validation funded
                  by the business. Provider fees may apply. Name mismatches go
                  to the Owner for review.
                  {state?.mode === "demo"
                    ? " This demo simulates verification and sends no money."
                    : " Validation requires enabled RazorpayX live access."}
                </T>
                <Choice
                  label="I confirm this bank account belongs to me and consent to verification"
                  checked={verificationConsent}
                  onPress={() => setVerificationConsent(!verificationConsent)}
                />
                <Button
                  label={
                    state?.mode === "demo"
                      ? "Simulate ₹1 bank verification"
                      : "Verify bank account with ₹1"
                  }
                  loading={busy}
                  disabled={
                    !verificationConsent ||
                    !state?.features?.bankVerification ||
                    ["processing", "unknown", "needs_review"].includes(
                      pro.bankVerification || "",
                    )
                  }
                  onPress={() =>
                    void request<{ status: string }>(
                      "/professional/bank/verify",
                      { consent: true },
                    )
                      .then((result) =>
                        setMessage(
                          result.status === "verified"
                            ? "Bank verified. Your payout account is ready."
                            : "Verification started. Check its status before requesting a payout.",
                        ),
                      )
                      .catch((e) => setMessage(e.message))
                  }
                />
                {["processing", "unknown"].includes(
                  pro.bankVerification || "",
                ) && (
                  <Button
                    label="Check bank verification status"
                    secondary
                    loading={busy}
                    onPress={() =>
                      void request<{ status: string }>(
                        "/professional/bank/check",
                        {},
                      )
                        .then((result) =>
                          setMessage("Bank verification: " + result.status),
                        )
                        .catch((e) => setMessage(e.message))
                    }
                  />
                )}
                {!state?.features?.bankVerification && (
                  <T color={c.muted}>
                    Bank verification is waiting for RazorpayX live
                    configuration.
                  </T>
                )}
              </>
            )}
            {message && <T>{message}</T>}
          </Card>
          <Card>
            <Input
              label="Payout amount (₹)"
              value={amount}
              onChangeText={setAmount}
              keyboardType="number-pad"
            />
            <T size={12} color={c.muted}>
              Minimum ₹100. The Owner reviews each withdrawal request.
            </T>
            <Button
              label="Request payout"
              disabled={
                pro.bankVerification !== "verified" ||
                (pro.bankEligibleAt || 0) > now
              }
              loading={busy}
              onPress={() =>
                void request("/payouts", {
                  amount: Number(amount),
                  idempotencyKey: key,
                })
                  .then(() => {
                    setAmount("");
                    setKey(
                      `payout-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    );
                  })
                  .catch(() => {})
              }
            />
          </Card>
        </>
      ) : (
        <Card>
          <T bold>
            {pro?.type === "Partner"
              ? "Partner withdrawals"
              : "In-house professional"}
          </T>
          <T color={c.muted}>
            {pro?.type === "Partner"
              ? "Withdrawals are temporarily unavailable. Your earnings remain in your ANVIRA balance. Contact support for help."
              : "In-house compensation is managed by ANVIRA. Completed job value is shown in your history."}
          </T>
        </Card>
      )}
      <T bold size={20}>
        Earnings ledger
      </T>
      <PageControls list={ledger} label="earnings" />
      {ledger.rows.map((l) => (
        <Card key={l.id}>
          <T bold>{dateLabel(l.createdAt)}</T>
          <T>Service value: {money(l.gross)}</T>
          <T>Platform commission: {money(l.commission)}</T>
          <T bold color={c.green}>
            Your earnings: {money(l.amount)}
          </T>
        </Card>
      ))}
      {!ledger.rows.length && (
        <T color={c.muted}>
          Completed partner jobs appear here with the commission deducted.
        </T>
      )}
      <T bold size={20}>
        Payout history
      </T>
      <PageControls list={payouts} label="payouts" />
      {payouts.rows.map((p) => (
        <Card key={p.id}>
          <Row>
            <T bold>{money(p.amount)}</T>
            <Badge label={p.status} />
          </Row>
          <T size={12}>{dateLabel(p.createdAt)}</T>
          {p.bankLast4 && <T size={12}>To bank •••• {p.bankLast4}</T>}
          {p.source && (
            <T size={12}>
              {p.source === "scheduled"
                ? "Scheduled payout"
                : "Requested withdrawal"}
            </T>
          )}
          {p.utr && (
            <T selectable size={12}>
              Bank reference: {p.utr}
            </T>
          )}
        </Card>
      ))}
    </>
  );
}
export function NotificationCenter() {
  const alerts = useBookingAlerts();
  const notifications =
    usePagedRecords<AppState["notifications"][number]>("notifications");
  const { request, busy } = useApp(),
    [message, setMessage] = useState("");
  async function enable() {
    try {
      if (Platform.OS === "web")
        throw new Error(
          "Push notifications are available in the iPhone and Android apps.",
        );
      if (!Device.isDevice)
        throw new Error("Use a physical device to enable push notifications.");
      if (Platform.OS === "android")
        await Notifications.setNotificationChannelAsync("default", {
          name: "Booking updates",
          importance: Notifications.AndroidImportance.HIGH,
        });
      let permissions = await Notifications.getPermissionsAsync();
      if (permissions.status !== "granted")
        permissions = await Notifications.requestPermissionsAsync();
      if (permissions.status !== "granted")
        throw new Error(
          "Notifications are disabled. Enable them in your phone settings.",
        );
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ||
        Constants.easConfig?.projectId;
      if (!projectId)
        throw new Error(
          "Notifications are not available yet. Booking updates will appear here.",
        );
      const token = await Notifications.getExpoPushTokenAsync({ projectId });
      const device = await request<{ id: string }>("/devices", {
        token: token.data,
      });
      await SecureStore.setItemAsync("anvira-device", device.id);
      setMessage("Booking notifications enabled.");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <Shell title="Notifications" back>
      <Card>
        <T bold size={20}>
          Booking alert sound
        </T>
        <T color={c.muted}>
          Receive a chime for new updates while this workspace is open. Your
          inbox keeps every update when sound is muted.
        </T>
        <Button
          label={
            alerts.enabled
              ? "Mute booking alert sound"
              : "Enable booking alert sound"
          }
          secondary
          onPress={() => void alerts.toggle()}
        />
        <Button
          label="Test booking alert"
          secondary
          onPress={() => void alerts.test()}
        />
        {!!alerts.message && <T accessibilityRole="alert">{alerts.message}</T>}
      </Card>
      <Card>
        <T bold>Stay close to your booking.</T>
        <T color={c.muted}>
          Get updates about payments, assignments and service progress.
        </T>
        <Button
          label="Enable notifications"
          loading={busy}
          secondary
          onPress={() => void enable()}
        />
        {message && <T>{message}</T>}
      </Card>
      <PageControls list={notifications} label="notifications" />
      {!!notifications.rows.filter((n) => !n.read).length && (
        <Button
          label="Mark this page as read"
          secondary
          loading={busy}
          onPress={() =>
            void request("/notifications/read-many", {
              ids: notifications.rows.filter((n) => !n.read).map((n) => n.id),
            }).catch(() => {})
          }
        />
      )}
      {notifications.rows.length ? (
        notifications.rows.map((n) => (
          <Pressable
            key={n.id}
            accessibilityRole="button"
            accessibilityLabel={n.title}
            onPress={() =>
              void request("/notifications/read", { id: n.id })
                .then(() => {
                  if (n.bookingId) go("/booking/" + n.bookingId);
                })
                .catch(() => {})
            }
          >
            <Card style={{ backgroundColor: n.read ? c.white : c.mint }}>
              <T bold>{n.title}</T>
              <T>{n.body}</T>
              <T size={11} color={c.muted}>
                {dateLabel(n.createdAt)}
              </T>
            </Card>
          </Pressable>
        ))
      ) : (
        <Empty
          title="You’re all caught up"
          detail="Booking updates will appear here."
        />
      )}
    </Shell>
  );
}
