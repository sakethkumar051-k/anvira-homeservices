import { useEffect, useState } from "react";
import { ScrollView, View, Pressable, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useApp } from "../lib/context";
import { Service } from "../lib/model";
import { Badge, Button, Icon, Row, T, c } from "./ui";
import BrandLogo from "./BrandLogo";
import { ServicePhoto } from "./ServicePhoto";
import { MenuRow } from "./MobileUI";

type PublicInfo = {
  termsUrl: string;
  privacyUrl: string;
  supportPhone: string;
  policyPublished: boolean;
};
export default function Welcome() {
  const { read, state, lang, setLang, t } = useApp();
  const [catalog, setCatalog] = useState<{
    services: Service[];
    mode: string;
  } | null>(null);
  const [company, setCompany] = useState<PublicInfo | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    void Promise.all([
      read<{ services: Service[]; mode: string }>("/catalog"),
      read<PublicInfo>("/public"),
    ])
      .then(([services, info]) => {
        if (current) {
          setCatalog(services);
          setCompany(info);
          setError("");
        }
      })
      .catch(() => {
        if (current)
          setError(
            "Service availability could not load. Please try again shortly.",
          );
      });
    return () => {
      current = false;
    };
  }, [read, attempt]);
  const openAccount = () =>
    router.push(
      !state
        ? "/sign-in"
        : state.user.role === "customer"
          ? "/home"
          : state.user.role === "professional"
            ? "/jobs"
            : "/dashboard/home",
    );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ivory }}>
      <View
        style={{ flex: 1, width: "100%", maxWidth: 520, alignSelf: "center" }}
      >
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 24, paddingBottom: 28 }}
        >
          <Row style={{ justifyContent: "space-between" }}>
            <BrandLogo width={86} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Switch language")}
              onPress={() => setLang(lang === "en" ? "te" : "en")}
              style={{
                minHeight: 44,
                justifyContent: "center",
                paddingHorizontal: 12,
              }}
            >
              <T bold size={13} color={c.green}>
                {lang === "en" ? "తెలుగు" : "English"}
              </T>
            </Pressable>
          </Row>
          <View
            style={{
              borderRadius: 26,
              overflow: "hidden",
              backgroundColor: c.mint,
            }}
          >
            <ServicePhoto category="home" style={{ height: 218 }} />
            <View
              style={{
                position: "absolute",
                bottom: 14,
                left: 14,
                backgroundColor: c.white,
                borderRadius: 12,
                padding: 10,
              }}
            >
              <Row style={{ gap: 6 }}>
                <Icon name="home" size={17} />
                <T size={12} bold>
                  ANVIRA Services
                </T>
              </Row>
            </View>
          </View>
          <View style={{ gap: 10 }}>
            <T bold size={32} color={c.forest} style={{ letterSpacing: -0.8 }}>
              Good care. Right at home.
            </T>
            <T size={14} color={c.muted}>
              Explore first. Sign in when you’re ready to book.
            </T>
          </View>
          <View style={{ gap: 16 }}>
            {[
              ["search", "Choose your service"],
              ["calendar", "Plan your visit"],
              ["check", "Review your booking"],
            ].map(([icon, label], index) => (
              <Row key={label}>
                <View
                  style={{
                    width: 38,
                    height: 38,
                    backgroundColor: c.mint,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name={icon} size={18} />
                </View>
                <T size={14} style={{ flex: 1 }}>
                  {label}
                </T>
                <T color={c.muted} size={11}>
                  {"0" + (index + 1)}
                </T>
              </Row>
            ))}
          </View>
          {catalog?.mode === "demo" && (
            <Badge label="Sample catalog · fictional prices" />
          )}
          {!!error && (
            <View style={{ gap: 10 }}>
              <T color={c.red}>{error}</T>
              <Button
                label="Retry"
                secondary
                onPress={() => setAttempt((value) => value + 1)}
              />
            </View>
          )}
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: c.line,
              paddingTop: 12,
            }}
          >
            <MenuRow
              icon="tool"
              label="Professional sign in"
              onPress={() => router.push("/sign-in?workspace=professional")}
            />
            <MenuRow
              icon="person"
              label="Staff sign in"
              onPress={() => router.push("/staff")}
            />
          </View>
          {company?.policyPublished && (
            <Row style={{ flexWrap: "wrap", gap: 20 }}>
              {[
                ["Terms", company.termsUrl],
                ["Privacy", company.privacyUrl],
              ]
                .filter(([, url]) => !!url)
                .map(([label, url]) => (
                  <Pressable
                    key={label}
                    accessibilityRole="link"
                    onPress={() =>
                      void Linking.openURL(url).catch(() =>
                        setError("This link could not open."),
                      )
                    }
                    style={{ minHeight: 44, justifyContent: "center" }}
                  >
                    <T size={12} color={c.muted}>
                      {label}
                    </T>
                  </Pressable>
                ))}
            </Row>
          )}
        </ScrollView>
        <View
          style={{
            padding: 20,
            paddingTop: 14,
            backgroundColor: c.white,
            borderTopWidth: 1,
            borderTopColor: c.line,
            gap: 10,
          }}
        >
          <Button
            label={state ? "Open my account" : "Get started"}
            onPress={openAccount}
          />
          <Button
            label="Browse services without signing in"
            secondary
            onPress={() => router.push("/catalog")}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
