import BrandLogo from "./BrandLogo";
import AppleSignInButton from "./AppleSignInButton";
import { useState, useEffect, useRef } from "react";
import { View, ScrollView, Pressable, Linking, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useIsFocused, useLocalSearchParams } from "expo-router";
import { useApp } from "../lib/context";
import { WEBSITE_STAFF_ONLY } from "../lib/runtime";
import {
  googleLogin,
  appleLogin,
  verificationEmail,
  emailLogin,
  emailRegister,
  resetPassword,
  prepareAuth,
  preparePhoneAuth,
  clearPhoneAuth,
  phoneLogin,
} from "../lib/auth";
import {
  validateEmail,
  validateRegistration,
  signInError,
  normalizeMobileNumber,
  validateVerificationCode,
  customerReturnTo,
} from "../lib/sign-in";
import { T, c, Button, Card, Input, Row } from "./ui";
export default function SignIn({
  staffOnly = WEBSITE_STAFF_ONLY,
}: { staffOnly?: boolean } = {}) {
  const focused = useIsFocused();
  const {
    state,
    completeLogin,
    initializing,
    error,
    lang,
    setLang,
    t,
    read,
    logout,
  } = useApp();
  const { workspace, returnTo } = useLocalSearchParams<{
    workspace?: string;
    returnTo?: string;
  }>();
  const professional = !staffOnly && workspace === "professional";
  const staff = staffOnly || professional;
  const [register, setRegister] = useState(false),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [showPassword, setShowPassword] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [notice, setNotice] = useState(false),
    [authReady, setAuthReady] = useState(false),
    [resetAt, setResetAt] = useState(0),
    [retryAt, setRetryAt] = useState(0),
    [clockNow, setClockNow] = useState(Date.now),
    [policies, setPolicies] = useState({
      termsUrl: "",
      privacyUrl: "",
      policyPublished: false,
    });
  const [method, setMethod] = useState<"phone" | "email">("phone"),
    [phone, setPhone] = useState(""),
    [code, setCode] = useState(""),
    [challenge, setChallenge] = useState<Awaited<
      ReturnType<typeof phoneLogin>
    > | null>(null),
    [resendAt, setResendAt] = useState(0),
    [automaticallyVerified, setAutomaticallyVerified] = useState(false);
  const verifiedToken = useRef("");
  const phoneMode = !staff && method === "phone";
  const resendSeconds = Math.max(0, Math.ceil((resendAt - clockNow) / 1000));
  const inFlight = useRef(false);
  useEffect(() => {
    if (!phoneMode || !authReady || challenge) return;
    // Pre-render verification while the number is entered; this never sends SMS.
    void preparePhoneAuth("phone-recaptcha").catch(() => {});
    return () => clearPhoneAuth();
  }, [phoneMode, authReady, challenge]);
  const waitSeconds = Math.max(0, Math.ceil((retryAt - clockNow) / 1000));
  useEffect(() => {
    if (!waitSeconds && !resendSeconds) return;
    const timer = setTimeout(() => setClockNow(Date.now()), 1000);
    return () => clearTimeout(timer);
  }, [waitSeconds, resendSeconds]);
  useEffect(() => {
    let cancelled = false;
    void prepareAuth()
      .then(() => {
        if (!cancelled) setAuthReady(true);
      })
      .catch((e) => {
        if (!cancelled) setMessage(signInError(e));
      });
    void read<typeof policies>("/public")
      .then((p) => {
        if (!cancelled) setPolicies(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [read]);
  useEffect(() => {
    if (focused && state) {
      if (staffOnly && !["owner", "care"].includes(state.user.role)) {
        logout();
        return;
      }
      router.replace(
        (state.user.role === "customer"
          ? customerReturnTo(returnTo)
          : state.user.role === "professional"
            ? "/jobs"
            : "/dashboard/home") as never,
      );
    }
  }, [focused, state, staffOnly, logout, returnTo]);
  async function phoneAction(verify: boolean) {
    if (
      inFlight.current ||
      waitSeconds ||
      (!verify && challenge && resendSeconds > 0)
    )
      return;
    inFlight.current = true;
    setBusy(true);
    setMessage("");
    setNotice(false);
    try {
      if (verify) {
        if (!challenge) return;
        const idToken =
          verifiedToken.current ||
          (await challenge.confirm(validateVerificationCode(code)));
        verifiedToken.current = idToken;
        await completeLogin(idToken);
        setCode("");
      } else {
        const normalized = normalizeMobileNumber(phone);
        const next = await phoneLogin(
          normalized,
          "phone-recaptcha",
          !!challenge,
        );
        verifiedToken.current = next.autoVerifiedToken || "";
        setAutomaticallyVerified(!!next.autoVerifiedToken);
        setChallenge(next);
        setCode("");
        setPhone(normalized.slice(3));
        if (next.autoVerifiedToken) {
          await completeLogin(next.autoVerifiedToken);
          return;
        }
        const now = Date.now();
        setClockNow(now);
        setResendAt(now + 60000);
      }
    } catch (e) {
      setMessage(signInError(e));
      const limited = e as {
        code?: string;
        status?: number;
        retryAfterSeconds?: number;
      };
      if (limited.status === 429 || limited.code === "auth/too-many-requests") {
        const now = Date.now();
        setClockNow(now);
        setRetryAt(now + (limited.retryAfterSeconds || 60) * 1000);
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function act(kind: "google" | "apple" | "email" | "reset") {
    if (staffOnly && (kind === "google" || kind === "apple")) return;
    if (inFlight.current || waitSeconds) return;
    inFlight.current = true;
    setBusy(true);
    setMessage("");
    setNotice(false);
    try {
      if (kind === "google") await completeLogin(await googleLogin());
      else if (kind === "apple") await completeLogin(await appleLogin());
      else {
        validateEmail(email);
        if (kind === "reset") {
          if (Date.now() - resetAt < 60000)
            throw new Error(
              "Please wait a minute before requesting another reset email.",
            );
          try {
            await resetPassword(email.trim());
          } catch (e) {
            if ((e as { code?: string }).code !== "auth/user-not-found")
              throw e;
          }
          setResetAt(Date.now());
          setNotice(true);
          setMessage(
            "If this account is registered, check your email for reset instructions.",
          );
        } else {
          if (register) validateRegistration(name, password, confirmation);
          else if (!password) throw new Error("Enter your password.");
          const idToken = register
            ? await emailRegister(email.trim(), password, name.trim())
            : await emailLogin(email.trim(), password);
          if (register) await verificationEmail().catch(() => {});
          await completeLogin(idToken);
          setPassword("");
          setConfirmation("");
        }
      }
    } catch (e) {
      setMessage(signInError(e));
      const limited = e as { status?: number; retryAfterSeconds?: number };
      if (limited.status === 429) {
        const now = Date.now();
        setClockNow(now);
        setRetryAt(now + (limited.retryAfterSeconds || 60) * 1000);
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ivory }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 20,
          paddingTop: 20,
          gap: 20,
          maxWidth: 480,
          width: "100%",
          alignSelf: "center",
        }}
      >
        <Row style={{ justifyContent: "space-between" }}>
          <BrandLogo width={86} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Change language")}
            onPress={() => setLang(lang === "en" ? "te" : "en")}
          >
            <T color={c.green}>{lang === "en" ? "తెలుగు" : "English"}</T>
          </Pressable>
        </Row>
        <View style={{ gap: 8 }}>
          <T size={28} bold>
            {staffOnly
              ? "Staff sign in"
              : professional
                ? "Professional sign in"
                : "Good care. Right at home."}
          </T>
          <T size={13} color={c.muted}>
            {staff
              ? staffOnly
                ? "Admin / Owner and Customer Associate: use the approved email and password provided for your staff account. Internal field workers do not need a login."
                : "Use your approved external professional account for offers, jobs and earnings. New professionals can create a customer account and apply from Profile."
              : phoneMode
                ? "Your next great service starts with your mobile number. No password needed."
                : "Sign in to keep your bookings, quotes and service updates together."}
          </T>
        </View>
        {!staff && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Browse services without signing in")}
            onPress={() => router.push("/catalog")}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <T size={13} color={c.green} bold>
              Browse services without signing in
            </T>
          </Pressable>
        )}
        <Card>
          {phoneMode && (
            <>
              <T size={22} bold>
                {challenge ? "Check your messages" : "Let’s get you started"}
              </T>
              <T color={c.muted}>
                {automaticallyVerified
                  ? "Your mobile number is verified. Continue securely to finish signing in."
                  : challenge
                    ? `Enter the 6-digit code sent to +91 ${phone}.`
                    : "Sign in or create an account with one SMS code."}
              </T>
              {!challenge ? (
                <>
                  <Input
                    label="Mobile number"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    autoComplete="tel-national"
                    textContentType="telephoneNumber"
                    placeholder="98765 43210"
                    maxLength={17}
                    editable={!busy}
                    returnKeyType="go"
                    onSubmitEditing={() => void phoneAction(false)}
                  />
                  <T size={12} color={c.muted}>
                    India (+91)
                  </T>
                  <Button
                    label="Get verification code"
                    loading={busy}
                    disabledReason={
                      "Sign-in is not ready or a retry timer is active. Check the sign-in status above."
                    }
                    disabled={!authReady || waitSeconds > 0}
                    onPress={() => void phoneAction(false)}
                  />
                  <T size={12} color={c.muted}>
                    By continuing, you agree to receive a verification SMS.
                    Standard message rates may apply. Google processes your
                    number to prevent abuse.
                  </T>
                </>
              ) : (
                <>
                  {!automaticallyVerified && (
                    <Input
                      label="Verification code"
                      value={code}
                      onChangeText={(value) =>
                        setCode(value.replace(/\D/g, "").slice(0, 6))
                      }
                      keyboardType="number-pad"
                      autoComplete={
                        Platform.OS === "android" ? "sms-otp" : "one-time-code"
                      }
                      textContentType="oneTimeCode"
                      placeholder="6-digit code"
                      maxLength={8}
                      autoFocus
                      editable={!busy}
                      returnKeyType="go"
                      onSubmitEditing={() => void phoneAction(true)}
                      style={{
                        fontSize: 24,
                        letterSpacing: 8,
                        textAlign: "center",
                      }}
                    />
                  )}
                  <Button
                    label={
                      automaticallyVerified
                        ? "Continue securely"
                        : "Verify & continue"
                    }
                    loading={busy}
                    disabledReason={
                      "Wait for sign-in to be ready and any retry timer to finish."
                    }
                    disabled={!authReady || waitSeconds > 0}
                    onPress={() => void phoneAction(true)}
                  />
                  {!automaticallyVerified && (
                    <Button
                      label={
                        resendSeconds
                          ? `Resend code in ${resendSeconds}s`
                          : "Resend code"
                      }
                      secondary
                      disabledReason={
                        busy
                          ? "Please wait for the current update to finish."
                          : "Wait for sign-in to be ready and any retry timer to finish."
                      }
                      disabled={busy || resendSeconds > 0 || waitSeconds > 0}
                      onPress={() => void phoneAction(false)}
                    />
                  )}
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => {
                      setChallenge(null);
                      setAutomaticallyVerified(false);
                      setCode("");
                      setMessage("");
                      verifiedToken.current = "";
                    }}
                  >
                    <T color={c.green} bold>
                      Change mobile number
                    </T>
                  </Pressable>
                </>
              )}
              <View nativeID="phone-recaptcha" />
              {!!(message || error) && (
                <T accessibilityRole="alert" color={c.red}>
                  {message || error}
                </T>
              )}
              {waitSeconds > 0 && (
                <T accessibilityLiveRegion="polite" size={12} color={c.muted}>
                  Please wait {waitSeconds}s before trying again. Your details
                  are kept.
                </T>
              )}
              <Row>
                <View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
                <T size={12} color={c.muted}>
                  or continue with
                </T>
                <View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
              </Row>
              <AppleSignInButton
                onPress={() => void act("apple")}
                disabled={!authReady || busy}
              />
              <Button
                label="Continue with Google"
                secondary
                disabledReason={
                  busy
                    ? "Please wait for the current update to finish."
                    : "Sign-in is not ready yet. Check the sign-in status above and try again."
                }
                disabled={!authReady || busy}
                onPress={() => void act("google")}
              />
              <T size={12} color={c.muted}>
                Already booked with Google or email? Use the same sign-in to
                keep your bookings.
              </T>
              <Button
                label="Use email instead"
                secondary
                disabled={busy}
                onPress={() => {
                  setMethod("email");
                  setMessage("");
                }}
              />
            </>
          )}
          {!phoneMode && (
            <>
              {!staffOnly && (
                <>
                  <AppleSignInButton
                    onPress={() => void act("apple")}
                    disabled={!authReady || busy}
                  />
                  <Button
                    label="Continue with Google"
                    secondary
                    disabledReason={
                      busy
                        ? "Please wait for the current update to finish."
                        : "Sign-in is not ready yet. Check the sign-in status above and try again."
                    }
                    disabled={!authReady || busy}
                    onPress={() => void act("google")}
                  />
                  <Row>
                    <View
                      style={{ flex: 1, height: 1, backgroundColor: c.line }}
                    />
                    <T size={12} color={c.muted}>
                      or use email
                    </T>
                    <View
                      style={{ flex: 1, height: 1, backgroundColor: c.line }}
                    />
                  </Row>
                </>
              )}
              {!staff && (
                <Row>
                  {[false, true].map((mode) => (
                    <Pressable
                      key={String(mode)}
                      accessibilityRole="button"
                      accessibilityState={{
                        selected: register === mode,
                        disabled: busy,
                      }}
                      disabled={busy}
                      onPress={() => {
                        setRegister(mode);
                        setMessage("");
                        setConfirmation("");
                      }}
                      style={{
                        flex: 1,
                        padding: 12,
                        borderRadius: 12,
                        backgroundColor: register === mode ? c.mint : c.soft,
                      }}
                    >
                      <T
                        bold
                        color={register === mode ? c.green : c.muted}
                        style={{ textAlign: "center" }}
                      >
                        {mode ? "Create account" : "Sign in"}
                      </T>
                    </Pressable>
                  ))}
                </Row>
              )}
              {register && (
                <Input
                  label="Your name"
                  value={name}
                  onChangeText={setName}
                  autoComplete="name"
                  maxLength={100}
                  editable={!busy}
                />
              )}
              <Input
                label="Email address"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                editable={!busy}
              />
              <Input
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={register ? "new-password" : "current-password"}
                textContentType={register ? "newPassword" : "password"}
                editable={!busy}
                returnKeyType={register ? "next" : "go"}
                onSubmitEditing={() => {
                  if (!register) void act("email");
                }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  showPassword ? "Hide password" : "Show password"
                }
                onPress={() => setShowPassword(!showPassword)}
              >
                <T size={12} color={c.green}>
                  {showPassword ? "Hide password" : "Show password"}
                </T>
              </Pressable>
              {register && (
                <>
                  <T size={12} color={c.muted}>
                    Use at least 8 characters. Choose a password unique to
                    ANVIRA.
                  </T>
                  <Input
                    label="Confirm password"
                    value={confirmation}
                    onChangeText={setConfirmation}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    editable={!busy}
                    returnKeyType="go"
                    onSubmitEditing={() => void act("email")}
                  />
                </>
              )}
              {!!(message || error) && (
                <T accessibilityRole="alert" color={notice ? c.green : c.red}>
                  {message || error}
                </T>
              )}
              {waitSeconds > 0 && (
                <T accessibilityLiveRegion="polite" size={12} color={c.muted}>
                  Please wait {waitSeconds}s before trying again. Your details
                  are kept.
                </T>
              )}
              {busy && (
                <T accessibilityLiveRegion="polite" size={12} color={c.muted}>
                  Connecting securely. The first connection can take about a
                  minute.
                </T>
              )}
              <Button
                label={
                  register ? "Create account & continue" : "Sign in with email"
                }
                loading={busy}
                disabledReason={
                  "Wait for sign-in to be ready and any retry timer to finish."
                }
                disabled={!authReady || waitSeconds > 0}
                onPress={() => void act("email")}
              />
              {!register && (
                <Button
                  label="Reset password"
                  secondary
                  disabledReason={
                    busy
                      ? "Please wait for the current update to finish."
                      : "Wait for sign-in to be ready before resetting your password."
                  }
                  disabled={busy || !authReady}
                  onPress={() => void act("reset")}
                />
              )}
              {!staff && (
                <Button
                  label="Use mobile number instead"
                  secondary
                  disabled={busy}
                  onPress={() => {
                    setMethod("phone");
                    setMessage("");
                  }}
                />
              )}
            </>
          )}
        </Card>
        {initializing && (
          <T size={12} color={c.muted}>
            Checking for an existing sign-in…
          </T>
        )}
        {policies.policyPublished && (
          <Row>
            {!!policies.termsUrl && (
              <Pressable
                accessibilityRole="link"
                onPress={() => void Linking.openURL(policies.termsUrl)}
              >
                <T size={12} color={c.green}>
                  Terms of service
                </T>
              </Pressable>
            )}
            {!!policies.privacyUrl && (
              <Pressable
                accessibilityRole="link"
                onPress={() => void Linking.openURL(policies.privacyUrl)}
              >
                <T size={12} color={c.green}>
                  Privacy policy
                </T>
              </Pressable>
            )}
          </Row>
        )}
        {!staffOnly && (
          <View style={{ gap: 12 }}>
            <Button
              label={professional ? "Customer sign in" : "Professional sign in"}
              secondary
              disabled={busy}
              onPress={() => {
                setRegister(false);
                setPassword("");
                setConfirmation("");
                setMessage("");
                router.replace(
                  professional ? "/sign-in" : "/sign-in?workspace=professional",
                );
              }}
            />
            <Button
              label="Staff sign in"
              secondary
              disabled={busy}
              onPress={() => router.push("/staff")}
            />
          </View>
        )}
        <T size={12} color={c.muted} style={{ textAlign: "center" }}>
          Your account opens the workspace approved for you.
        </T>
      </ScrollView>
    </SafeAreaView>
  );
}
