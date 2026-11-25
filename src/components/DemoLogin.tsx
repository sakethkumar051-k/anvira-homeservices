import { customerReturnTo } from "../lib/sign-in";
import BrandLogo from "./BrandLogo";
import { useEffect, useRef } from "react";
import { View, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useIsFocused, useLocalSearchParams } from "expo-router";
import { useApp } from "../lib/context";
import { Role } from "../lib/model";
import { T, c, Art, Button, Card, Row, Icon } from "../components/ui";
export default function DemoLogin({
  staffOnly = false,
}: { staffOnly?: boolean } = {}) {
  const focused = useIsFocused();
  const { login, state, initializing, busy, error, lang, setLang, t, logout } =
    useApp();
  const { sample, workspace, returnTo } = useLocalSearchParams<{
    sample?: string;
    workspace?: string;
    returnTo?: string;
  }>();
  const professional = workspace === "professional";
  const entered = useRef(false);
  useEffect(() => {
    if (
      focused &&
      (staffOnly
        ? ["owner", "care"]
        : ["customer", "professional", "owner", "care"]
      ).includes(sample || "") &&
      !entered.current &&
      !initializing &&
      !state
    ) {
      entered.current = true;
      void login(sample as Role);
    }
  }, [focused, sample, state, login, initializing, staffOnly]);
  async function enter(role: Role) {
    await login(role);
  }
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
  if (state) return null;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ivory }}>
      <ScrollView
        contentContainerStyle={{
          padding: 24,
          gap: 28,
          maxWidth: 480,
          width: "100%",
          alignSelf: "center",
          paddingTop: 56,
        }}
      >
        <Row style={{ justifyContent: "space-between" }}>
          <BrandLogo width={150} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Change language")}
            onPress={() => setLang(lang === "en" ? "te" : "en")}
          >
            <T color={c.green}>{lang === "en" ? "తెలుగు" : "English"}</T>
          </Pressable>
        </Row>
        {!staffOnly && <Art />}
        <View style={{ gap: 12 }}>
          <T bold size={32}>
            Good care. Right at home.
          </T>
          <T color={c.muted}>
            {staffOnly
              ? "Admin / Owner and Customer Associate staff workspace."
              : "Explore ANVIRA’s customer, professional and operations experiences."}
          </T>
        </View>
        <Card style={{ backgroundColor: c.mint }}>
          <Row>
            <Icon name="shield" />
            <T bold>Interactive development preview</T>
          </Row>
          <T size={12} color={c.muted}>
            Sample services and demo accounts. No real charges or payouts.
          </T>
        </Card>
        {!!error && (
          <T accessibilityRole="alert" color={c.red}>
            {error}
          </T>
        )}
        {!staffOnly && (
          <Button
            label="Start five-minute product demo"
            secondary
            onPress={() => router.push("/demo")}
          />
        )}
        {!staffOnly && !professional && (
          <Button
            label="Enter customer app"
            loading={busy}
            onPress={() => void enter("customer")}
          />
        )}
        {!staffOnly && (
          <Button
            label="Enter professional app"
            secondary
            disabled={busy}
            onPress={() => void enter("professional")}
          />
        )}
        <Row>
          <View style={{ flex: 1 }}>
            <Button
              label={staffOnly ? "Admin / Owner" : "Owner dashboard"}
              secondary
              disabled={busy}
              onPress={() => void enter("owner")}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label={staffOnly ? "Customer Associate" : "Customer Care"}
              secondary
              disabled={busy}
              onPress={() => void enter("care")}
            />
          </View>
        </Row>
        {!staffOnly && (
          <Button
            label="Staff sign in"
            secondary
            onPress={() => router.push("/staff")}
          />
        )}
        <T size={11} color={c.muted}>
          Shadnagar launch preview · English + తెలుగు
        </T>
      </ScrollView>
    </SafeAreaView>
  );
}
