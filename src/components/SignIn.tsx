import AppleSignInButton from "./AppleSignInButton";
import { useState, useEffect, useRef } from "react";
import {
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
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
} from "../lib/auth";
import {
  validateEmail,
  validateRegistration,
  signInError,
} from "../lib/sign-in";
import { T, c, Art, Button, Card, Input, Row } from "./ui";
export default function SignIn({
  staffOnly = WEBSITE_STAFF_ONLY,
}: { staffOnly?: boolean } = {}) {
  const {
    state,
    completeLogin,
    initializing,
    error,
    lang,
    setLang,
    read,
    logout,
  } = useApp();
  const [register, setRegister] = useState(false),
    [staff, setStaff] = useState(staffOnly),
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
    [policies, setPolicies] = useState({
      termsUrl: "",
      privacyUrl: "",
      policyPublished: false,
    });
  const inFlight = useRef(false);
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
    if (state) {
      if (staffOnly && !["owner", "care"].includes(state.user.role)) {
        logout();
        return;
      }
      router.replace(
        (state.user.role === "customer"
          ? "/home"
          : state.user.role === "professional"
            ? "/jobs"
            : "/dashboard/home") as never,
      );
    }
  }, [state, staffOnly, logout]);
  async function act(kind: "google" | "apple" | "email" | "reset") {
    if (staffOnly && (kind === "google" || kind === "apple")) return;
    if (inFlight.current) return;
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
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  if (initializing)
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator color={c.green} />
      </View>
    );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ivory }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 24,
          paddingTop: 32,
          gap: 20,
          maxWidth: 480,
          width: "100%",
          alignSelf: "center",
        }}
      >
        <Row style={{ justifyContent: "space-between" }}>
          <View>
            <T bold size={24} color={c.green}>
              ANVIRA
            </T>
            <T size={10} color={c.muted}>
              HOME SERVICES
            </T>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change language"
            onPress={() => setLang(lang === "en" ? "te" : "en")}
          >
            <T color={c.green}>{lang === "en" ? "తెలుగు" : "English"}</T>
          </Pressable>
        </Row>
        {!staffOnly && <Art height={130} />}
        <View style={{ gap: 8 }}>
          <T size={28} bold>
            {staff ? "Welcome to your workspace" : "Good care. Right at home."}
          </T>
          <T color={c.muted}>
            {staff
              ? staffOnly
                ? "Use your Owner email and password, or the credentials your Owner provided for Customer Care."
                : "Sign in with your approved Owner, Care or professional account."
              : "Continue with Google or use your email and password."}
          </T>
        </View>
        {!staff && (
          <Button
            label="Browse services without signing in"
            secondary
            onPress={() => router.push("/catalog")}
          />
        )}
        <Card>
          {!staffOnly && (
            <>
              <AppleSignInButton
                onPress={() => void act("apple")}
                disabled={!authReady || busy}
              />
              <Button
                label="Continue with Google"
                secondary
                disabled={!authReady || busy}
                onPress={() => void act("google")}
              />
              <Row>
                <View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
                <T size={12} color={c.muted}>
                  or use email
                </T>
                <View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
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
                Use at least 8 characters. Choose a password unique to ANVIRA.
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
          {(message || error) && (
            <T accessibilityRole="alert" color={notice ? c.green : c.red}>
              {message || error}
            </T>
          )}
          <Button
            label={
              register ? "Create account & continue" : "Sign in with email"
            }
            loading={busy}
            disabled={!authReady}
            onPress={() => void act("email")}
          />
          {!register && (
            <Button
              label="Reset password"
              secondary
              disabled={busy || !authReady}
              onPress={() => void act("reset")}
            />
          )}
        </Card>
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
          <Button
            label={staff ? "Customer sign in" : "Owner & professional sign in"}
            secondary
            disabled={busy}
            onPress={() => {
              setStaff(!staff);
              setRegister(false);
              setPassword("");
              setConfirmation("");
              setMessage("");
            }}
          />
        )}
        <T size={12} color={c.muted} style={{ textAlign: "center" }}>
          Your account opens the workspace approved for you.
        </T>
      </ScrollView>
    </SafeAreaView>
  );
}
