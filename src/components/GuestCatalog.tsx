import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useApp } from "../lib/context";
import { Service } from "../lib/model";
import { Badge, Button, Empty, Row, T, c } from "./ui";
import BrandLogo from "./BrandLogo";
import { MonthlyCarCare, ServiceCatalog } from "./ServiceCatalog";
import { PromotionalCarousel } from "./PromotionalCarousel";
import type { PromotionalBanner } from "../lib/model";

type Catalog = {
  services: Service[];
  mode: string;
  pins: string[];
  banners?: PromotionalBanner[];
};
export default function GuestCatalog() {
  const { read, state, lang, setLang, t } = useApp();
  const { category } = useLocalSearchParams<{ category?: string }>();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    void read<Catalog>("/catalog")
      .then((result) => {
        if (current) setCatalog(result);
      })
      .catch((e) => {
        if (current) setError(e.message || "Please try again.");
      });
    return () => {
      current = false;
    };
  }, [read, attempt]);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ivory }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          width: "100%",
          maxWidth: 520,
          alignSelf: "center",
          padding: 20,
          gap: 18,
        }}
      >
        <Row style={{ justifyContent: "space-between", gap: 8 }}>
          <BrandLogo width={78} />
          <Row style={{ gap: 12 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Switch language")}
              onPress={() => setLang(lang === "en" ? "te" : "en")}
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <T size={12} bold color={c.green}>
                {lang === "en" ? "తెలుగు" : "English"}
              </T>
            </Pressable>
            <Button
              label={state ? "Open my account" : "Sign in"}
              secondary
              onPress={() => router.push(state ? "/home" : "/sign-in")}
            />
          </Row>
        </Row>
        <View style={{ gap: 4 }}>
          <T bold size={26}>
            Services for your home
          </T>
          <T color={c.muted}>Explore packages and prices in Shadnagar.</T>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push("/sign-in?workspace=professional&mode=create")
          }
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <T size={13} color={c.green} bold>
            Work with ANVIRA · Professional sign up
          </T>
        </Pressable>
        {catalog?.mode === "demo" && (
          <Badge label="Sample catalog · fictional prices" />
        )}
        <PromotionalCarousel
          banners={catalog?.banners || []}
          services={catalog?.services || []}
        />
        {!category && catalog && <MonthlyCarCare services={catalog.services} />}
        {catalog ? (
          <ServiceCatalog
            key={category || "all"}
            initialCategory={category}
            services={catalog.services}
          />
        ) : error ? (
          <>
            <Empty title="Couldn’t load services" detail={error} />
            <Button
              label="Retry"
              onPress={() => {
                setError("");
                setAttempt((n) => n + 1);
              }}
            />
          </>
        ) : (
          <T accessibilityLiveRegion="polite">Loading services…</T>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
